import {
  addDoc,
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { firebaseAuth, firebaseDb, firebaseEnabled } from "./client";
import { ensureFirebaseChatLogin } from "./chatAuth";

export type ChatConversation = {
  id: string;
  userUid: string;
  userId?: number;
  userName?: string;
  staffUid?: string | null;
  staffId?: number | null;
  staffName?: string | null;
  status: "WAITING" | "ACTIVE" | "CLOSED" | string;
  createdAt?: { seconds?: number; nanoseconds?: number } | Date | null;
  updatedAt?: { seconds?: number; nanoseconds?: number } | Date | null;
  lastMessage?: string;
  lastMessageAt?: { seconds?: number; nanoseconds?: number } | Date | null;
  unreadByUser?: number;
  unreadByStaff?: number;
  tags?: string[];
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" | string;
  pinnedByStaff?: boolean;
  internalNote?: string;
  waitingFor?: "STAFF" | "USER" | string;
};

export type ChatMessage = {
  id: string;
  senderUid: string;
  senderRole: string;
  senderName?: string;
  content: string;
  createdAt?: { seconds?: number; nanoseconds?: number } | Date | null;
  read?: boolean;
};

function requireFirebaseDb() {
  if (!firebaseEnabled || !firebaseDb || !firebaseAuth) {
    throw new Error(
      "Firebase chưa sẵn sàng. Hãy kiểm tra cấu hình Firebase phía frontend.",
    );
  }
  return { db: firebaseDb, auth: firebaseAuth };
}

function toMillis(
  value:
    | ChatConversation["updatedAt"]
    | ChatConversation["lastMessageAt"]
    | ChatMessage["createdAt"],
) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && typeof value.seconds === "number") {
    return value.seconds * 1000;
  }
  return 0;
}

export async function listenMyConversations(
  callback: (items: ChatConversation[]) => void,
): Promise<Unsubscribe> {
  await ensureFirebaseChatLogin();
  const { db, auth } = requireFirebaseDb();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Bạn chưa đăng nhập Firebase Chat.");

  const q = query(collection(db, "conversations"), where("userUid", "==", uid));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs
      .map((entry) => ({
        id: entry.id,
        ...(entry.data() as Omit<ChatConversation, "id">),
      }))
      .sort(
        (left, right) => toMillis(right.updatedAt) - toMillis(left.updatedAt),
      );
    callback(items);
  });
}

export async function listenAssignedConversations(
  callback: (items: ChatConversation[]) => void,
): Promise<Unsubscribe> {
  await ensureFirebaseChatLogin();
  const { db, auth } = requireFirebaseDb();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Bạn chưa đăng nhập Firebase Chat.");

  const q = query(
    collection(db, "conversations"),
    where("staffUid", "==", uid),
  );
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs
      .map((entry) => ({
        id: entry.id,
        ...(entry.data() as Omit<ChatConversation, "id">),
      }))
      .sort(
        (left, right) => toMillis(right.updatedAt) - toMillis(left.updatedAt),
      );
    callback(items);
  });
}

export async function listenMessages(
  conversationId: string,
  callback: (items: ChatMessage[]) => void,
): Promise<Unsubscribe> {
  await ensureFirebaseChatLogin();
  const { db } = requireFirebaseDb();
  const q = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("createdAt", "asc"),
  );
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((entry) => ({
      id: entry.id,
      ...(entry.data() as Omit<ChatMessage, "id">),
    }));
    callback(items);
  });
}

export async function sendConversationMessage(
  conversationId: string,
  content: string,
  senderRole: string,
  senderName: string,
): Promise<void> {
  const safeContent = String(content || "").trim();
  if (!safeContent) return;

  await ensureFirebaseChatLogin();
  const { db, auth } = requireFirebaseDb();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Bạn chưa đăng nhập Firebase Chat.");

  await addDoc(collection(db, "conversations", conversationId, "messages"), {
    senderUid: uid,
    senderRole,
    senderName,
    content: safeContent,
    createdAt: serverTimestamp(),
    read: false,
  });

  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: safeContent,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    unreadByUser: senderRole === "STAFF" ? increment(1) : 0,
    unreadByStaff: senderRole === "USER" ? increment(1) : 0,
    waitingFor: senderRole === "STAFF" ? "USER" : "STAFF",
  });
}

export async function upsertStaffStatus(params: {
  staffUid: string;
  staffId: string;
  staffName: string;
  acceptingChats: boolean;
  currentLoad?: number;
  maxLoad: number;
}): Promise<void> {
  await ensureFirebaseChatLogin();
  const { db } = requireFirebaseDb();
  const payload: Record<string, unknown> = {
    staffUid: params.staffUid,
    staffId: Number(params.staffId),
    staffName: params.staffName,
    acceptingChats: params.acceptingChats,
    maxLoad: params.maxLoad,
    lastSeenAt: serverTimestamp(),
  };

  if (typeof params.currentLoad === "number") {
    payload.currentLoad = params.currentLoad;
  }

  await setDoc(doc(db, "staff_status", params.staffUid), payload, {
    merge: true,
  });
}

export async function updateConversationMetadata(
  conversationId: string,
  payload: Partial<
    Pick<
      ChatConversation,
      "tags" | "priority" | "pinnedByStaff" | "internalNote" | "waitingFor"
    >
  >,
): Promise<void> {
  await ensureFirebaseChatLogin();
  const { db } = requireFirebaseDb();
  await updateDoc(doc(db, "conversations", conversationId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function markConversationReadForStaff(
  conversationId: string,
): Promise<void> {
  await ensureFirebaseChatLogin();
  const { db } = requireFirebaseDb();
  await updateDoc(doc(db, "conversations", conversationId), {
    unreadByStaff: 0,
  });
}

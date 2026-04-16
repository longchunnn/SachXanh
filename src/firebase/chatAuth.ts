import { signInWithCustomToken } from "firebase/auth";
import axiosClient from "../services/axiosClient";
import { firebaseAuth, firebaseEnabled } from "./client";
import { unwrapResult } from "../utils/apiResponse";

type FirebaseTokenPayload = {
  token: string;
  uid: string;
  primary_role: string;
  user_id: number;
  full_name: string;
};

let currentUid: string | null = null;

export async function ensureFirebaseChatLogin(): Promise<string> {
  if (!firebaseEnabled || !firebaseAuth) {
    throw new Error(
      "Chưa cấu hình Firebase cho frontend. Hãy kiểm tra file .env và Firebase setup.",
    );
  }

  const response = await axiosClient.get("/firebase/custom-token");
  const payload = unwrapResult<FirebaseTokenPayload>(response);

  if (!payload?.token || !payload.uid) {
    throw new Error("Backend không trả về Firebase custom token hợp lệ.");
  }

  if (firebaseAuth.currentUser?.uid === payload.uid && currentUid === payload.uid) {
    return payload.uid;
  }

  await signInWithCustomToken(firebaseAuth, payload.token);
  currentUid = payload.uid;
  return payload.uid;
}

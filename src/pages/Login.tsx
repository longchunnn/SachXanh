import { useState } from "react";
import { normalizeRole } from "../utils/roles";
import { parseJwtPayload } from "../utils/jwt";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRightOutlined, BookOutlined } from "@ant-design/icons";
import type { FirebaseError } from "firebase/app";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import {
  getCurrentUserProfile,
  loginWithEmailOrUsername,
  loginWithGoogleIdToken,
} from "../services/authService";
import { setAccessToken } from "../services/axiosClient";
import { toast } from "react-toastify";
import { useForm } from "react-hook-form";
import { firebaseAuth, firebaseEnabled } from "../firebase/client";
import { useAppDispatch } from "../app/hooks";
import { setUser } from "../features/session/sessionSlice";

type LoginFormValues = {
  account: string;
  password: string;
  remember: boolean;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    defaultValues: {
      account: "",
      password: "",
      remember: false,
    },
  });
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError("");

    try {
      setIsSubmitting(true);
      const response = await loginWithEmailOrUsername(
        values.account,
        values.password,
      );

      setAccessToken(response.accessToken);
      try {
        const me = await getCurrentUserProfile();
        dispatch(setUser(me));
      } catch {
        // Keep JWT-based session as fallback if profile endpoint fails.
      }
      const payload = parseJwtPayload(response.accessToken);
      const primaryRole = normalizeRole(payload?.primary_role);
      toast.success("Đăng nhập thành công");

      const fromPath = (
        location.state as { from?: { pathname?: string } } | null
      )?.from?.pathname;

      const defaultTarget =
        primaryRole === "ADMIN"
          ? "/admin"
          : primaryRole === "STAFF" || primaryRole === "MANAGER"
            ? "/staff"
            : "/";

      const canUseFromPath =
        typeof fromPath === "string" &&
        (fromPath.startsWith("/admin")
          ? primaryRole === "ADMIN"
          : fromPath.startsWith("/staff")
            ? primaryRole === "ADMIN" ||
              primaryRole === "STAFF" ||
              primaryRole === "MANAGER"
            : true);

      navigate(canUseFromPath ? fromPath! : defaultTarget, { replace: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Đăng nhập thất bại, vui lòng thử lại.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitError("");
    try {
      if (!firebaseEnabled || !firebaseAuth) {
        throw new Error(
          "Chưa cấu hình Firebase cho frontend. Vui lòng kiểm tra lại file .env.",
        );
      }

      setIsGoogleSubmitting(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const credential = await signInWithPopup(firebaseAuth, provider);
      const idToken = await credential.user.getIdToken(true);

      const response = await loginWithGoogleIdToken(idToken);
      setAccessToken(response.accessToken);
      try {
        const me = await getCurrentUserProfile();
        dispatch(setUser(me));
      } catch {
        // Keep JWT-based session as fallback if profile endpoint fails.
      }
      const payload = parseJwtPayload(response.accessToken);
      const primaryRole = normalizeRole(payload?.primary_role);
      toast.success("Đăng nhập Google thành công");
      navigate(
        primaryRole === "ADMIN" ||
          primaryRole === "STAFF" ||
          primaryRole === "MANAGER"
          ? "/staff"
          : "/",
      );
    } catch (error) {
      const firebaseErrorCode = (error as FirebaseError | undefined)?.code;
      const message = mapGoogleLoginError(error, firebaseErrorCode);
      setSubmitError(message);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const mapGoogleLoginError = (
    error: unknown,
    firebaseErrorCode: string | undefined,
  ) => {
    if (firebaseErrorCode === "auth/popup-closed-by-user") {
      return "Bạn đã đóng cửa sổ đăng nhập Google.";
    }
    if (firebaseErrorCode === "auth/cancelled-popup-request") {
      return "Yêu cầu đăng nhập Google đã bị huỷ.";
    }
    if (firebaseErrorCode === "auth/unauthorized-domain") {
      return "Domain hiện tại chưa được cấp quyền trong Firebase Authentication.";
    }
    if (firebaseErrorCode === "auth/account-exists-with-different-credential") {
      return "Email này đã tồn tại với phương thức đăng nhập khác.";
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return "Đăng nhập Google thất bại, vui lòng thử lại.";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 md:p-8">
      {/* Khung chính chứa toàn bộ form */}
      <div className="max-w-5xl w-full bg-white rounded-2xl shadow-xl flex flex-col md:flex-row overflow-hidden">
        <div
          className="hidden md:flex md:w-1/2 p-12 flex-col justify-between relative bg-teal-900 text-white"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(6, 78, 89, 0.85), rgba(6, 78, 89, 0.95)), url('https://images.unsplash.com/photo-1507842217343-583bb7270b66?q=80&w=1000')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="flex items-center gap-2 text-2xl font-['Merriweather'] italic font-semibold z-10">
            <BookOutlined />
            <span>Sách Xanh</span>
          </div>
          <div className="z-10 mt-12 mb-auto">
            <h1 className="text-4xl text-center lg:text-5xl font-['Merriweather'] leading-tight mb-6">
              <br /> Nơi lưu giữ tinh hoa thế giới <br /> <br />
            </h1>
            <p className="text-teal-50 text-base max-w-md leading-relaxed opacity-90">
              Truy cập bộ sưu tập văn chương được chọn lọc và tiếp tục hành
              trình khám phá những câu chuyện tinh hoa nhất thế giới.
            </p>
          </div>
          <div className="z-10 text-xs tracking-widest uppercase opacity-70 mt-8">
            Khởi đầu từ năm 2024
          </div>
        </div>

        <div className="w-full md:w-1/2 p-8 md:p-14 lg:p-16 flex flex-col justify-center bg-white">
          <div className="mb-10">
            <h2 className="text-3xl font-['Merriweather'] text-gray-800 mb-2">
              Chào mừng trở lại
            </h2>
            <p className="text-gray-500 text-sm">
              Vui lòng nhập thông tin để truy cập thư viện của bạn
            </p>
          </div>

          <form
            className="space-y-6"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <div>
              <label className="block text-xs font-semibold text-gray-500 tracking-wider mb-2 uppercase">
                Tài khoản
              </label>
              <input
                type="text"
                placeholder="Nhập tài khoản"
                {...register("account", {
                  required: "Vui lòng nhập tài khoản.",
                  validate: (value) => {
                    const normalized = String(value || "").trim();
                    if (!normalized) return "Vui lòng nhập tài khoản.";

                    const isUsername = /^[a-zA-Z0-9._-]{4,20}$/.test(
                      normalized,
                    );
                    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                      normalized,
                    );

                    return (
                      isUsername ||
                      isEmail ||
                      "Vui lòng nhập username (4-20 ký tự) hoặc email hợp lệ."
                    );
                  },
                })}
                className="w-full bg-gray-50 border border-transparent focus:border-teal-600 focus:bg-white focus:ring-0 rounded-md px-4 py-3 text-sm text-gray-800 outline-none transition-all"
              />
              {errors.account?.message ? (
                <p className="mt-2 text-xs text-red-600">
                  {errors.account.message}
                </p>
              ) : null}
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-gray-500 tracking-wider uppercase">
                  Mật khẩu
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-teal-700 hover:text-teal-800 font-medium hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                {...register("password", {
                  required: "Vui lòng nhập mật khẩu.",
                  minLength: {
                    value: 6,
                    message: "Mật khẩu phải có ít nhất 6 ký tự.",
                  },
                })}
                className="w-full bg-gray-50 border border-transparent focus:border-teal-600 focus:bg-white focus:ring-0 rounded-md px-4 py-3 text-sm text-gray-800 outline-none transition-all tracking-widest"
              />
              {errors.password?.message ? (
                <p className="mt-2 text-xs text-red-600">
                  {errors.password.message}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="remember"
                {...register("remember")}
                className="w-4 h-4 text-teal-700 border-gray-300 rounded focus:ring-teal-600 cursor-pointer"
              />
              <label
                htmlFor="remember"
                className="text-sm text-gray-600 cursor-pointer"
              >
                Duy trì đăng nhập
              </label>
            </div>
            {submitError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#7a4b27] hover:bg-[#633c1f] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-md transition-colors tracking-wide mt-2"
            >
              {isSubmitting ? "ĐANG ĐĂNG NHẬP..." : "ĐĂNG NHẬP"}
            </button>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleSubmitting}
              className="w-full border border-gray-300 hover:border-gray-400 bg-white disabled:opacity-60 disabled:cursor-not-allowed text-gray-700 font-semibold py-3.5 rounded-md transition-colors tracking-wide flex items-center justify-center gap-2"
            >
              <span className="inline-block h-4 w-4 rounded-full bg-red-500" />
              {isGoogleSubmitting
                ? "ĐANG ĐĂNG NHẬP GOOGLE..."
                : "ĐĂNG NHẬP VỚI GOOGLE"}
            </button>
          </form>
          <div className="h-px bg-gray-100 w-full my-8"></div>
          <div className="text-center flex flex-col items-center">
            <span className="text-gray-500 text-sm mb-2">
              Chưa có tài khoản?
            </span>
            <Link
              to="/register"
              className="text-teal-700 font-semibold text-sm hover:text-teal-800 flex items-center gap-1 group"
            >
              Tạo tài khoản mới
              <ArrowRightOutlined className="text-xs transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
      <div className="mt-10 text-[11px] text-gray-400 tracking-widest uppercase text-center font-medium space-x-2">
        <span>© {new Date().getFullYear()} Sách Xanh</span>
        <span>•</span>
        <Link to="/privacy" className="hover:text-gray-600">
          Riêng tư
        </Link>
        <span>•</span>
        <Link to="/terms" className="hover:text-gray-600">
          Điều khoản
        </Link>
      </div>
    </div>
  );
}

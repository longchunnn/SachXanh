import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { BookOutlined, ReadOutlined } from "@ant-design/icons";

type RegisterFormValues = {
  fullName: string;
  username: string;
  email: string;
  password: string;
};

export default function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = () => {};

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="py-4 px-6 md:px-12 flex justify-between items-center border-b border-gray-100 z-10 relative bg-white">
        <div className="text-2xl font-['Merriweather'] font-bold text-teal-900 italic cursor-pointer">
          Sách Xanh
        </div>
        <Link
          to="/login"
          className="bg-[#0b3d45] hover:bg-teal-900 text-white px-6 py-2.5 text-sm font-semibold rounded transition-colors shadow-sm"
        >
          Đăng nhập
        </Link>
      </header>
      <main className="flex-1 flex flex-col md:flex-row w-full h-full">
        <div className="w-full md:w-7/12 lg:w-3/5 flex flex-col justify-center items-center p-8 md:p-12 lg:p-20 relative bg-white">
          <div className="w-full max-w-md">
            <div className="text-center mb-10">
              <h1 className="text-3xl lg:text-4xl font-['Merriweather'] text-teal-900 mb-4 leading-snug">
                Bắt Đầu Câu Chuyện Của <br /> Bạn
              </h1>
              <p className="text-gray-500 text-sm">
                Gia nhập không gian lưu giữ tri thức hiện đại của chúng tôi.
              </p>
            </div>
            <form
              className="space-y-5"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              <div>
                <label className="block text-xs font-bold text-gray-600 tracking-wider mb-2 uppercase">
                  Họ và tên
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  {...register("fullName", {
                    required: "Vui lòng nhập họ và tên.",
                    minLength: {
                      value: 2,
                      message: "Họ và tên phải có ít nhất 2 ký tự.",
                    },
                  })}
                  className="w-full bg-gray-50 border border-transparent focus:border-teal-600 focus:bg-white focus:ring-0 rounded-md px-4 py-3 text-sm text-gray-800 outline-none transition-all"
                />
                {errors.fullName?.message ? (
                  <p className="mt-2 text-xs text-red-600">
                    {errors.fullName.message}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 tracking-wider mb-2 uppercase">
                  Tài khoản
                </label>
                <input
                  type="text"
                  placeholder="Nhập tên tài khoản"
                  {...register("username", {
                    required: "Vui lòng nhập tài khoản.",
                    pattern: {
                      value: /^[a-zA-Z0-9._-]{4,20}$/,
                      message:
                        "Tài khoản 4-20 ký tự, chỉ gồm chữ, số, ., _, -.",
                    },
                  })}
                  className="w-full bg-gray-50 border border-transparent focus:border-teal-600 focus:bg-white focus:ring-0 rounded-md px-4 py-3 text-sm text-gray-800 outline-none transition-all"
                />
                {errors.username?.message ? (
                  <p className="mt-2 text-xs text-red-600">
                    {errors.username.message}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 tracking-wider mb-2 uppercase">
                  Địa chỉ Email
                </label>
                <input
                  type="email"
                  placeholder="email@sachxanh.com"
                  {...register("email", {
                    required: "Vui lòng nhập email.",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Email không đúng định dạng.",
                    },
                  })}
                  className="w-full bg-gray-50 border border-transparent focus:border-teal-600 focus:bg-white focus:ring-0 rounded-md px-4 py-3 text-sm text-gray-800 outline-none transition-all"
                />
                {errors.email?.message ? (
                  <p className="mt-2 text-xs text-red-600">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 tracking-wider mb-2 uppercase">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  {...register("password", {
                    required: "Vui lòng nhập mật khẩu.",
                    minLength: {
                      value: 8,
                      message: "Mật khẩu phải có ít nhất 8 ký tự.",
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
              <button
                type="submit"
                className="w-full bg-[#7a4b27] hover:bg-[#633c1f] text-white font-semibold py-3.5 rounded-md transition-colors tracking-wide mt-4 shadow-md"
              >
                Đăng ký
              </button>
            </form>
            <div className="text-center mt-8">
              <span className="text-gray-500 text-sm">Đã có tài khoản? </span>
              <Link
                to="/login"
                className="text-teal-800 font-semibold text-sm hover:text-teal-600 hover:underline"
              >
                Đăng nhập
              </Link>
            </div>
            <div className="mt-16 text-center flex items-center justify-center gap-2 opacity-50">
              <ReadOutlined className="text-gray-500" />
              <span className="text-[10px] tracking-[0.2em] uppercase font-semibold text-gray-500">
                Tinh hoa văn học được chọn lọc
              </span>
            </div>
          </div>
        </div>
        <div
          className="hidden md:flex md:w-5/12 lg:w-2/5 relative bg-gray-900"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=1000')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="absolute inset-0 flex items-center justify-center p-8 lg:p-10">
            <div className="bg-black/50 backdrop-blur-md p-8 lg:p-10 rounded-2xl text-center text-white w-full max-w-sm border border-white/10 shadow-2xl">
              <BookOutlined className="text-4xl mb-5 opacity-90" />
              <h2 className="text-2xl lg:text-3xl font-['Merriweather'] mb-4 font-medium tracking-wide">
                Vũ Trụ Tư Duy
              </h2>
              <p className="text-sm opacity-80 leading-relaxed font-light px-4">
                "Một căn phòng không có sách cũng giống như một cơ thể không có
                linh hồn."
                <br />
                <span className="inline-block mt-2 font-medium">
                  — Marcus Tullius Cicero
                </span>
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* === FOOTER === */}
      <footer className="py-6 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center text-sm border-t border-gray-100 bg-white gap-4">
        <div className="font-bold text-teal-900">Sách Xanh</div>

        <div className="text-gray-400 text-xs">
          © {new Date().getFullYear()} Sách Xanh. Được thiết kế cho Độc giả Hiện
          đại.
        </div>

        <div className="flex gap-6 text-gray-500">
          <Link to="/privacy" className="hover:text-teal-700 transition-colors">
            Chính sách bảo mật
          </Link>
          <Link to="/terms" className="hover:text-teal-700 transition-colors">
            Điều khoản dịch vụ
          </Link>
          <Link to="/contact" className="hover:text-teal-700 transition-colors">
            Liên hệ
          </Link>
        </div>
      </footer>
    </div>
  );
}

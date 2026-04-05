import { Link } from 'react-router-dom'; // Dùng thẻ Link để chuyển trang không bị load lại

export default function Footer() {
  return (
    // Lớp nền xám nhạt (bg-gray-100) phủ toàn bộ chiều ngang
    <footer className="bg-gray-100 py-10 mt-16 border-t border-gray-200">
      
      {/* Khung giới hạn nội dung bằng đúng 7xl để thẳng tắp với Banner và Sách ở trên */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        
        {/* === CỘT TRÁI: Logo và Text bản quyền === */}
        <div className="flex flex-col">
          <div className="text-2xl font-['Merriweather'] font-bold text-teal-800 mb-3 italic">
            Sách Xanh
          </div>
          <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
            {/* Mẹo: Dùng new Date().getFullYear() để năm luôn tự động cập nhật nhé */}
            © {new Date().getFullYear()} Sách Xanh. Tuyển chọn những câu chuyện cho độc giả tinh tế.
          </p>
        </div>

        {/* === CỘT PHẢI: Các đường link === */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-gray-500">
          <Link to="/privacy" className="hover:text-teal-800 hover:underline underline-offset-4 transition-all">
            Chính sách Bảo mật
          </Link>
          <Link to="/terms" className="hover:text-teal-800 hover:underline underline-offset-4 transition-all">
            Điều khoản Dịch vụ
          </Link>
          <Link to="/shipping" className="hover:text-teal-800 hover:underline underline-offset-4 transition-all">
            Giao hàng & Trả hàng
          </Link>
          <Link to="/wholesale" className="hover:text-teal-800 hover:underline underline-offset-4 transition-all">
            Bán sỉ
          </Link>
          <Link to="/contact" className="hover:text-teal-800 hover:underline underline-offset-4 transition-all">
            Liên hệ
          </Link>
        </div>

      </div>
    </footer>
  );
}
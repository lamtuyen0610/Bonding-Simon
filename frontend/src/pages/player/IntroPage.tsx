import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function IntroPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/story/intro-bg.jpg)" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/95 via-ink/70 to-ink/95" aria-hidden="true" />

      <div className="relative min-h-screen flex flex-col justify-between px-6 py-14 sm:py-20 max-w-xl mx-auto">
        <div />

        <div className="space-y-5 text-white/90 leading-relaxed text-[15px] sm:text-base font-mono">
          <p>Tháng 10 năm 2002,</p>
          <p>
            Thạnh Sơn không chỉ nóng bởi cái nắng oi nồng mà còn bởi mùi tro tàn mục ruỗng. Giữa hiện trường đổ nát
            sau một đám cháy của một căn trọ nhỏ, hai sinh mạng đã mãi mãi nằm lại.
            <br />
            Nhưng lửa không thể thiêu rụi hết mọi bí mật.
          </p>
          <p>
            Vào vai Nguyễn Cao Khiết — 1 điều tra viên trẻ, bạn tiếp quản hồ sơ từ cấp trên để dấn thân vào một mê
            cung của những lời khai đầy mâu thuẫn và các dấu vết bất thường.
            <br />
            Khi tàn tro nguội lạnh cũng là lúc những góc khuất trong quá khứ trỗi dậy.
          </p>
          <p>Liệu đây là một tai nạn rủi ro,</p>
          <p>hay là màn kịch tàn khốc của một vụ trọng án chưa lời giải?</p>
        </div>

        <button className="btn-primary w-full mt-10" onClick={() => navigate("/join")}>
          Tiếp theo <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * Chuẩn hóa đáp án để so sánh: bỏ khoảng trắng thừa ở đầu/cuối,
 * gộp nhiều khoảng trắng liên tiếp thành một, và chuyển về chữ thường.
 * Không phân biệt dấu tiếng Việt có "chỉnh" hay không được thực hiện ở đây
 * (Admin có thể thêm alias trong AcceptedAnswer nếu cần biến thể có/không dấu).
 */
export function normalizeAnswer(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

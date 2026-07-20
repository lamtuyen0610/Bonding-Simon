import "dotenv/config";
import { server } from "./app";

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server KHỞI NGUỒN đang chạy tại http://0.0.0.0:${PORT}`);
  console.log(`Các thiết bị trong cùng mạng LAN có thể truy cập server qua địa chỉ IP của máy này, ví dụ: http://192.168.1.x:${PORT}`);
});

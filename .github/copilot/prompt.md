# Custom Instructions cho Dự án Pet Shop

Chào Copilot. Đây là các hướng dẫn để bạn có thể hỗ trợ tốt nhất cho dự án "Pet Shop" này. Dự án bao gồm một backend, một frontend, và các cấu hình Docker để triển khai.

## Quy tắc chung toàn dự án

- **Ngôn ngữ**: Luôn luôn trả lời và đề xuất code bằng **tiếng Việt**.
- **KHÔNG HARD-CODE CREDENTIALS**: Đây là quy tắc quan trọng nhất. **Tuyệt đối không** viết các thông tin nhạy cảm (chuỗi kết nối database, API keys, secret keys, mật khẩu) trực tiếp vào code. Luôn sử dụng biến môi trường (ví dụ: `process.env.VARIABLE_NAME`) và nhắc nhở tôi định nghĩa chúng trong tệp `.env`.
- **Giải thích code**: Với những đoạn code phức tạp hoặc các tệp cấu hình (như Docker, CI/CD), hãy thêm bình luận hoặc giải thích ngắn gọn về chức năng và lý do tại sao lại viết như vậy.

---

## Bối cảnh 1: Backend (Thư mục `be-petshop`)

Khi tôi đang làm việc trong các tệp thuộc thư mục `be-petshop`, hãy áp dụng các hướng dẫn sau:

### **What to know about this codebase?**
- **Mục đích**: Đây là một máy chủ API RESTful, được xây dựng bằng Node.js và Express.js.
- **Kiến trúc**: Tuân theo kiến trúc MVC (Model-View-Controller). Logic nghiệp vụ nằm trong services, controllers chỉ điều hướng request/response.
- **Cơ sở dữ liệu**: Sử dụng MongoDB và Mongoose. Các models nằm trong `src/models`.
- **Xác thực**: Sử dụng JSON Web Tokens (JWT). Middleware xác thực nằm trong `src/middlewares/auth.js`.
- **Thư viện chính**: `express`, `mongoose`, `jsonwebtoken`, `bcryptjs`, `dotenv`.

### **How should Copilot behave?**
- **Sử dụng Async/Await**: Ưu tiên `async/await` và bọc trong khối `try...catch` để xử lý lỗi.
- **Bám sát kiến trúc MVC**: Khi tạo tính năng mới, hãy tạo code cho cả controller, service, và model tương ứng.
- **Response nhất quán**: Các response thành công trả về `{ success: true, data: ... }` và lỗi trả về `{ success: false, message: '...' }`. Sử dụng mã trạng thái HTTP phù hợp.
- **Bảo mật**: Luôn băm mật khẩu người dùng bằng `bcryptjs`.

---

## Bối cảnh 2: Frontend (Thư mục `fe-petshop`)

Khi tôi đang làm việc trong các tệp thuộc thư mục `fe-petshop`, hãy áp dụng các hướng dẫn sau:

### **What to know about this codebase?**
- **Mục đích**: Đây là giao diện người dùng (UI), được xây dựng bằng React.
- **Kiến trúc**: Dựa trên component. Các components được chia thành `pages`, `components/common` (tái sử dụng), và `features`.
- **Quản lý State**: Sử dụng Redux Toolkit. Các slice nằm trong `src/store/slices`. Các lệnh gọi API bất đồng bộ dùng `createAsyncThunk`.
- **Tương tác API**: Sử dụng `axios`. Một instance đã được cấu hình sẵn trong `src/api/axiosClient.js`.
- **Routing**: Sử dụng `react-router-dom`.
- **Biến môi trường**: Sử dụng các biến có tiền tố `REACT_APP_`.

### **How should Copilot behave?**
- **Ưu tiên Functional Components và Hooks**: Luôn tạo component dạng hàm và sử dụng React Hooks.
- **Sử dụng Redux Toolkit**: Đề xuất tạo/sử dụng các slice, actions, và `createAsyncThunk` để quản lý state và gọi API.
- **Chia nhỏ Components**: Khuyến khích chia các component lớn thành các component con nhỏ hơn và dễ tái sử dụng.
- **Xử lý lỗi API**: Luôn cung cấp cách xử lý lỗi khi gọi API, ví dụ như hiển thị thông báo cho người dùng.

---

## Bối cảnh 3: Cấu hình và DevOps (Các tệp ở thư mục gốc)

Khi tôi đang làm việc với các tệp như `Dockerfile`, `docker-compose.yml`, `package.json` ở thư mục gốc, hoặc các tệp trong `.github/workflows`, hãy áp dụng các hướng dẫn sau:

### **What to know about this context?**
- **Mục đích**: Các tệp này dùng để cấu hình, xây dựng, và triển khai toàn bộ ứng dụng bằng Docker, Docker Compose và GitHub Actions.
- **Tệp chính**:
  - `docker-compose.yml`: Định nghĩa các services cho backend, frontend, database.
  - `Dockerfile`: (Có thể có nhiều tệp Dockerfile trong `be-petshop` và `fe-petshop`) Dùng để xây dựng các images.
  - `package.json`: Chứa các scripts để quản lý dự án.
  - `.github/workflows/*.yml`: Các quy trình CI/CD.

### **How should Copilot behave?**
- **Tập trung vào cấu hình**: Đưa ra đề xuất liên quan đến cú pháp và các phương pháp tốt nhất cho Docker và GitHub Actions.
- **Tối ưu hóa**: Đề xuất các cách để tối ưu hóa `Dockerfile` (ví dụ: multi-stage builds) và `docker-compose.yml`.
- **Bảo mật trong cấu hình**: Nhắc nhở sử dụng secrets của Docker hoặc GitHub Actions thay vì viết thẳng thông tin nhạy cảm vào tệp cấu hình.
- **Giải thích rõ ràng**: Khi đề xuất một thay đổi, hãy giải thích tác động của nó. Ví dụ: "Thêm `volume` này để đồng bộ hóa code, giúp phát triển nhanh hơn."
const puppeteer = require('puppeteer');

(async () => {
  // 1. Khởi chạy trình duyệt Chrome đã cài đặt
  const browser = await puppeteer.launch({
    headless: true // Chạy ngầm không hiện giao diện. Đổi thành false nếu muốn nhìn thấy Chrome bật lên.
  });

  // 2. Mở một trang mới
  const page = await browser.newPage();

  // 3. Đi tới trang web mong muốn
  console.log('Đang kết nối tới trang web DEPENDENCY_TRACK');
  await page.goto('https://172.29.1.91:8080');

  // 4. Chụp ảnh màn hình lưu lại
  await page.screenshot({ path: 'dependency.png' });
  console.log('Đã chụp ảnh màn hình thành công và lưu thành file dependency.png!');

  // 5. Đóng trình duyệt
  await browser.close();
})();
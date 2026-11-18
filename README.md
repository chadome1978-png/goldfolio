# ทองพอร์ต

เว็บแอปส่วนตัวสำหรับติดตามทองคำแท่งและทองรูปพรรณ 96.5% ด้วย Dashboard, CRUD และการคำนวณมูลค่า/กำไรขาดทุนโดยประมาณจากราคาสมาคมค้าทองคำที่ดึงอัตโนมัติเมื่อเปิดแอปและทุก 2 นาทีขณะเปิดใช้งาน ฟอร์มซื้อเข้าใช้พื้นผิวทองและ accent แดง; หน้า Overview กำลังทดลอง palette **ทอง + น้ำเงินเข้ม** ส่วนแท็บอื่นยังคง theme เดิม

ภาพ Preview ล่าสุด: Dashboard ทอง–น้ำเงิน [Desktop](dashboard-theme-gold-blue-desktop.png) และ [Mobile](dashboard-theme-gold-blue-mobile.png); ภาพฟอร์มซื้อเข้าก่อนหน้า `add-transaction-form-preview.webp`.

## การตัดสินใจด้านราคา/ข้อมูล

- มี Node server เฉพาะ proxy ราคาสาธารณะจากสมาคมฯ เพราะ upstream ไม่เปิด CORS; server ไม่ได้รับรายการทอง/ต้นทุน/รูปภาพ/ใบรับประกัน
- รายการทอง รูป/เอกสาร และ quote ล่าสุดยังเก็บใน IndexedDB ของ browser เครื่องที่ใช้อยู่; Cloud Sync ไป BNK ยังไม่เปิดใช้งานและยังไม่มีข้อมูล Goldfolio บันทึกใน Supabase
- รูปและเอกสารรับประกันเก็บใน record ของ IndexedDB ไม่อัปโหลดขึ้น server; รูปถูกปรับขนาดก่อนเก็บ, PDF จำกัด 5 MB และไฟล์ backup รุ่นเดิมที่ไม่มี attachments ยังนำเข้าได้
- ดึงราคาทองแท่งรับซื้อ/ขายออกและรูปพรรณฐานภาษี/ขายออกจาก endpoint ทางการ; เวลาเผยแพร่ของสมาคมฯ แสดงแยกจากเวลาที่ดึงข้อมูล
- เมื่อเชื่อมต่อไม่ได้ ใช้ quote ล่าสุดในเครื่องและแจ้งสถานะ; ผู้ใช้กรอกราคาสำรองได้ โดยราคาทางการจะกลับมาเป็นค่าหลักเมื่อเชื่อมต่อสำเร็จครั้งถัดไป
- ส่งออก/นำเข้าข้อมูลสำรอง JSON; ควรสำรองก่อนล้าง browser หรือเปลี่ยนอุปกรณ์
- ดูแผนพัฒนาและสถานะที่ `plan.md`, `TODO.md`, `BUILD-PLAN.md`, `PRICE-SOURCE.md` และ `SUPABASE-SECURITY.md`

## คำสั่ง

- `pnpm dev` — เปิด development preview ที่ port 3000
- `pnpm build` — ตรวจ TypeScript และสร้าง static output ใน `dist/`
- `pnpm start` — เริ่ม production Node API/static server (ตั้ง `PORT` ได้)
- `pnpm preview` — serve production build เพื่อ QA

แอปยังไม่เผยแพร่สู่ public hosting; เปิดดูผ่าน Preview ของโปรเจกต์ใน Manus

# ทองพอร์ต

เว็บแอปส่วนตัวสำหรับติดตามทองคำแท่งและทองรูปพรรณ 96.5% ด้วย Dashboard, CRUD, การคำนวณมูลค่า/กำไรขาดทุนโดยประมาณ และราคาอ้างอิงสมาคมค้าทองคำที่ผู้ใช้บันทึกเอง ธีมฐานเดิมเป็น Dark Mode แดงทับทิม–ทอง; ขณะนี้หน้า Overview มี preview ธีมน้ำเงินเข้มเงาโลหะบนพื้นทองอ่อนสว่างตามคำขอ โดยจำกัดเฉพาะหน้าภาพรวม ส่วนแท็บอื่นยังใช้ธีมเดิมจนกว่าผู้ใช้จะยืนยัน

ภาพ preview: `dashboard-theme-preview-desktop.png` และ `dashboard-theme-preview-mobile.png`.

## การตัดสินใจด้านราคา/ข้อมูล

- ไม่มี managed server หรือ cloud database; รายการทองและราคาถูกเก็บใน IndexedDB ของ browser เครื่องที่ใช้อยู่
- ราคาสมาคมฯ ไม่ได้ดึงอัตโนมัติ: ผู้ใช้กรอกรับซื้อ/ขายออกของทองแท่ง และฐานภาษี/ขายออกของทองรูปพรรณ พร้อมเวลาไทย
- ส่งออก/นำเข้าข้อมูลสำรอง JSON; ควรสำรองก่อนล้าง browser หรือเปลี่ยนอุปกรณ์
- ดูแผนพัฒนาและข้อควรทราบที่ `plan.md`, `BUILD-PLAN.md` และ `PRICE-SOURCE.md`

## คำสั่ง

- `pnpm dev` — เปิด development preview ที่ port 3000
- `pnpm build` — ตรวจ TypeScript และสร้าง static output ใน `dist/`
- `pnpm preview` — serve production build เพื่อ QA

แอปยังไม่เผยแพร่สู่ public hosting; เปิดดูผ่าน Preview ของโปรเจกต์ใน Manus

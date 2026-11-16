# ทองพอร์ต

เว็บแอปส่วนตัวสำหรับติดตามทองคำแท่งและทองรูปพรรณ 96.5% ด้วย Dashboard, CRUD, การคำนวณมูลค่า/กำไรขาดทุนโดยประมาณ และราคาอ้างอิงสมาคมค้าทองคำที่ผู้ใช้บันทึกเอง ฟอร์มซื้อเข้าแนบรูปทองและใบรับประกัน (ภาพ/PDF) ได้ โดยเก็บในอุปกรณ์และรวมในไฟล์สำรอง; แบบฟอร์มใช้สีทอง–แดง ส่วนหน้า Overview ยังใช้ธีมทอง–แดงตามที่ออกแบบ และแท็บอื่นยังใช้ธีมเดิม

ภาพ Preview: Dashboard `dashboard-theme-gold-red-desktop.png` และ `dashboard-theme-gold-red-mobile.png`; หน้าฟอร์มซื้อเข้า `add-transaction-form-preview.webp`.

## การตัดสินใจด้านราคา/ข้อมูล

- ไม่มี managed server หรือ cloud database; รายการทองและราคาถูกเก็บใน IndexedDB ของ browser เครื่องที่ใช้อยู่
- รูปและเอกสารรับประกันเก็บใน record ของ IndexedDB ไม่อัปโหลดขึ้น server; รูปถูกปรับขนาดก่อนเก็บ, PDF จำกัด 5 MB และไฟล์ backup รุ่นเดิมที่ไม่มี attachments ยังนำเข้าได้
- ราคาสมาคมฯ ไม่ได้ดึงอัตโนมัติ: ผู้ใช้กรอกรับซื้อ/ขายออกของทองแท่ง และฐานภาษี/ขายออกของทองรูปพรรณ พร้อมเวลาไทย
- ส่งออก/นำเข้าข้อมูลสำรอง JSON; ควรสำรองก่อนล้าง browser หรือเปลี่ยนอุปกรณ์
- ดูแผนพัฒนาและข้อควรทราบที่ `plan.md`, `BUILD-PLAN.md` และ `PRICE-SOURCE.md`

## คำสั่ง

- `pnpm dev` — เปิด development preview ที่ port 3000
- `pnpm build` — ตรวจ TypeScript และสร้าง static output ใน `dist/`
- `pnpm preview` — serve production build เพื่อ QA

แอปยังไม่เผยแพร่สู่ public hosting; เปิดดูผ่าน Preview ของโปรเจกต์ใน Manus

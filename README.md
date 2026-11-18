# ทองพอร์ต

เว็บแอปส่วนตัวสำหรับติดตามทองคำแท่งและทองรูปพรรณ 96.5% บนมือถือและ desktop มี Dashboard, CRUD, ไฟล์แนบ และการคำนวณมูลค่า/กำไรขาดทุนโดยประมาณจากราคาสมาคมค้าทองคำที่ดึงอัตโนมัติเมื่อเปิดแอปและทุก 2 นาทีขณะเปิดใช้งาน

หน้า **Overview** กำลังทดลองธีมตามภาพอ้างอิง: **Graphite/Charcoal + ทองเมทัลลิก** พร้อมตัวอักษรขาวนวล/เทาอ่อน; ใช้ CSS sheen และเส้นเรืองแสงทองบนการ์ดราคาโดยไม่คัดลอกโลโก้หรือโฆษณาในภาพ แท็บอื่นยังใช้ธีมเดิมจนกว่าจะยืนยันขยาย

ภาพ Preview ล่าสุด: [Dashboard Desktop](dashboard-theme-graphite-gold-desktop.png) · [Dashboard Mobile](dashboard-theme-graphite-gold-mobile.png) · [ฟอร์มซื้อเข้า](add-transaction-form-preview.webp)

## การตัดสินใจด้านราคา/ข้อมูล

- มี Node server เฉพาะ proxy ราคาสาธารณะจากสมาคมฯ เพราะ upstream ไม่เปิด CORS; server ไม่ได้รับรายการทอง ต้นทุน รูปภาพ หรือใบรับประกัน
- ราคาสมาคมฯ ดึงอัตโนมัติและรีเฟรชทุก 2 นาทีขณะเปิดแอป; หากเชื่อมต่อไม่ได้ ใช้ quote ล่าสุดในเครื่องและแจ้งสถานะ; ผู้ใช้กรอกราคาสำรองได้
- รายการทอง รูป/เอกสารแนบ และ quote ล่าสุดยังเก็บใน IndexedDB ของ browser เครื่องที่ใช้อยู่; Cloud Sync ไป BNK ยังไม่เปิดใช้งานและยังไม่มีข้อมูล Goldfolio บันทึกใน Supabase
- รูป/เอกสารยังไม่อัปโหลดขึ้น server; รูปถูกปรับขนาดก่อนเก็บ, PDF จำกัด 5 MB และไฟล์ backup รุ่นเดิมที่ไม่มี attachments ยังนำเข้าได้
- ส่งออก/นำเข้าข้อมูลสำรอง JSON; ควรสำรองก่อนล้าง browser หรือเปลี่ยนอุปกรณ์
- แผนและสถานะการพัฒนาอยู่ใน `plan.md`, `TODO.md`, `BUILD-PLAN.md`, `PRICE-SOURCE.md` และ `SUPABASE-SECURITY.md`

## คำสั่ง

- `pnpm dev` — เปิด development preview ที่ port 3000
- `pnpm build` — ตรวจ TypeScript และสร้าง static output ใน `dist/`
- `pnpm start` — เริ่ม production Node API/static server (ตั้ง `PORT` ได้)
- `pnpm preview` — serve production build เพื่อ QA

แอปยังไม่เผยแพร่สู่ public hosting; เปิดดูผ่าน Preview ของโปรเจกต์ใน Manus

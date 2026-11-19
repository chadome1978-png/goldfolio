# ทองพอร์ต

เว็บแอปส่วนตัวสำหรับติดตามทองคำแท่งและทองรูปพรรณ 96.5% บนมือถือและ desktop มี Dashboard, เพิ่ม/แก้ไข/ลบรายการ, ไฟล์แนบ และคำนวณมูลค่า/กำไรขาดทุนโดยประมาณจากราคาสมาคมค้าทองคำซึ่งดึงผ่าน Node server เมื่อเปิดแอปและทุก 2 นาทีขณะเปิดใช้งาน

ทุกแท็บใช้ธีม **Graphite/Charcoal + Metallic Gold** พร้อมตัวอักษรขาวนวล/เทาอ่อน; รายการทองและไฟล์แนบคงอยู่ใน IndexedDB เพื่อใช้งานแบบ local-first และส่งออก/นำเข้า JSON ได้

## สถานะ Cloud Sync

สร้าง schema เฉพาะ Goldfolio ใน Supabase BNK (`etsguakphlytlvzotmor`) แล้ว ได้แก่ `public.goldfolio_holdings`, `public.goldfolio_preferences` และ private bucket `goldfolio-attachments` โดยเปิด/บังคับ RLS และไม่ให้ browser roles อ่าน/เขียนโดยตรง

โค้ด Manus OAuth, API ฝั่ง Node, Cloud Sync แบบ owner-scoped และหน้าขอยินยอมก่อน first sync เพิ่มไว้แล้ว แต่ **ยังไม่ยืนยันการเชื่อมต่อหรือการบันทึกข้อมูลจริง** จนกว่าจะกำหนด protected secrets ผ่าน input card ของ WebDev และทดสอบ end-to-end; ขณะนี้ยังไม่มี Goldfolio records ที่ซิงก์ไป BNK ผู้ใช้ต้องยืนยันก่อนส่งข้อมูล local ครั้งแรก

เมื่อกำหนดค่า secret ในอนาคต ใช้ `GOLDFOLIO_SUPABASE_SECRET_KEY` สำหรับ PostgREST จาก server และ `GOLDFOLIO_SUPABASE_STORAGE_SERVICE_KEY` สำหรับ private Storage จาก server เท่านั้น ห้ามใส่ค่า credential ใน source, client bundle, `.env` ที่ commit, log หรือ public repository

## ราคาและข้อมูล

- Node server proxy อ่านราคาสาธารณะจากสมาคมฯ เพราะ upstream ไม่เปิด CORS; server ไม่รับรายการทองและราคาซื้อส่วนตัวเพื่อคำนวณ
- ราคาอ้างอิงรีเฟรชทุก 2 นาทีขณะเปิดแอป; หากเชื่อมต่อไม่ได้ใช้ quote cache ในอุปกรณ์และแสดงสถานะ พร้อมรองรับราคาสำรองที่ผู้ใช้กรอกเอง
- รูปทองและเอกสารแนบเก็บใน IndexedDB ก่อน; private Storage รับเฉพาะ JPEG/PNG/WebP/PDF ขนาดไม่เกิน 5 MiB ต่อไฟล์ ผ่าน server หลังเปิด Cloud Sync
- ไฟล์สำรอง JSON เก็บข้อมูลในพอร์ตและราคาไว้กับผู้ใช้ ควรเก็บในที่ปลอดภัย

## คำสั่ง

- `pnpm dev` — เปิด development preview ที่ port 3000
- `pnpm build` — ตรวจ TypeScript และสร้าง static output ใน `dist/`
- `pnpm start` — เริ่ม production Node API/static server (ตั้ง `PORT` ได้)
- `pnpm preview` — serve production build เพื่อ QA

ยังไม่ publish เวอร์ชันใหม่นี้; การเผยแพร่ต้องรอผู้ใช้สั่งโดยชัดแจ้ง

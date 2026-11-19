# TODO — ทองพอร์ต

## MVP ที่พัฒนาและทดสอบแล้ว
- [x] Dashboard แสดงจำนวน น้ำหนัก ต้นทุนรวม มูลค่า และกำไร/ขาดทุนโดยประมาณของพอร์ต
- [x] สรุปสัดส่วนและผลลัพธ์แยกทองแท่ง/ทองรูปพรรณ
- [x] เพิ่ม แก้ไข ลบ และเปิดรายละเอียดรายการทอง
- [x] ฟอร์มซื้อเข้าแนบรูปทองและใบรับประกัน (ภาพ/PDF) พร้อม preview/เปลี่ยน/ลบ; image compression และ validation
- [x] แสดงไฟล์แนบในรายละเอียด; IndexedDB local cache และ JSON export/import (รวม attachments, รองรับ backup รุ่นเดิม)
- [x] ราคาสมาคมฯ ผ่าน Node proxy; initial fetch + refresh ทุก 2 นาทีขณะเปิดหน้า, ปุ่ม refresh, status, manual fallback, stale warning >24h
- [x] Dashboard คำนวณมูลค่าและ P/L ใหม่เมื่อ quote เปลี่ยน; quote cache คงอยู่ในเครื่อง
- [x] ยุบสถานะการเชื่อมต่อเป็น badge กับราคาทองทั้ง desktop/mobile
- [x] ธีม Overview ทอง–แดงเป็น preview รอบก่อน; หน้าอื่นคง theme ที่เลือกและ responsive layout
- [x] Build ผ่าน, endpoint official ผ่าน parser/production smoke, Dashboard price refresh และ recalculation ทดสอบใน Preview; QA data ถูกล้าง

## Cloud Sync ใน BNK — schema และโค้ดพร้อม; รอ protected credentials เพื่อทดสอบ end-to-end
- [x] สร้าง additive migration เฉพาะ `public.goldfolio_*`; ไม่แตะ schema, records หรือ files ของ RoomRent
- [x] เปิดและบังคับ RLS สำหรับตารางใหม่; ถอน browser-role grants และตรวจว่า `service_role` เท่านั้นมีสิทธิ์
- [x] สร้าง private bucket `goldfolio-attachments` พร้อม MIME allowlist (JPEG/PNG/WebP/PDF) และจำกัดไฟล์ไม่เกิน 5 MiB; ตรวจ private status และ restrictive server-only policy
- [x] เพิ่ม Manus OAuth ตาม WebDev contract: one-time state/nonce, ตรวจ app session JWT, cookie `webdev_app_session`, จำกัด trusted redirect origin และ derive `owner_id` จาก `openId` ที่ยืนยันแล้ว
- [x] เพิ่ม authenticated server APIs ที่ derive owner จาก session เท่านั้น; ทุก query filter ด้วย owner ID และไม่มี Supabase credential ใน browser bundle
- [x] เพิ่มแผงบัญชี/Cloud Sync แสดง logged-in/out, sync off/on, จำนวนรายการ/ไฟล์, เวลาซิงก์, pending/error/retry และ first-sync consent
- [x] คง IndexedDB/JSON backup เป็น local/offline fallback; sync queue/tombstones เก็บในเครื่องและไม่ลบข้อมูล local เมื่อ server ตอบผิดพลาด
- [x] เพิ่ม first-sync flow ที่ไม่ upload local data ก่อนกดยืนยัน; มีทางยกเลิกและ merge holdings/ไฟล์แนบกับ remote หลังยินยอม
- [x] เพิ่ม code สำหรับ sync CRUD/attachments เมื่อออนไลน์, conflict resolution ด้วย `updatedAt`, pending retry และ remote deletion tombstones
- [x] Official quote ไม่ sync; manual fallback ส่วนตัวเก็บและ sync ผ่าน preferences เมื่อเปิด Cloud Sync เท่านั้น
- [x] เพิ่ม server-only upload/download/delete ไปยัง private Storage พร้อมตรวจ session, ownership, MIME signature และขนาดไฟล์
- [ ] กำหนด `GOLDFOLIO_SUPABASE_SECRET_KEY` และ `GOLDFOLIO_SUPABASE_STORAGE_SERVICE_KEY` ผ่าน protected WebDev secret input; ห้ามแสดงหรือ commit ค่า secret
- [ ] หลัง credentials พร้อม ทดสอบ OAuth, first-sync cancel/confirm, owner isolation, CRUD/attachments, preferences, conflict/tombstone, offline retry และ legacy backups ด้วย session จริง
- [x] `pnpm build`, `git diff --check` และ Node syntax checks ผ่าน; WebDev `database:false`/`auto_publish:false`; ยังไม่ publish

## ธีมที่ตรวจรอบก่อน — ทอง + น้ำเงิน (เฉพาะ Overview)
- [x] คงพื้น/การ์ดทองของหน้า Overview แต่เปลี่ยน accent จากแดงเป็นน้ำเงินเข้ม; ใช้น้ำเงินกับ active/brand/button accents และตัวอักษรขาวบนปุ่มน้ำเงิน
- [x] ตรวจ contrast ของน้ำเงินบนพื้นทอง/ครีมให้ผ่านระดับอ่านสบาย; คงแดงเฉพาะความหมายสถานะผิดพลาด/ขาดทุน ไม่เปลี่ยนสีของแท็บอื่น
- [x] ตรวจ Preview desktop และ mobile ว่า hierarchy, CTA, price status, navigation และ card accents ยังอ่านชัดและไม่ล้น viewport

## Graphite + Metallic Gold (ธีมร่วมทุกหน้า ตามคำขอผู้ใช้)
- [x] ใช้พื้น charcoal/graphite เป็นธีมร่วมทุกแท็บ รวมหน้า Holdings, Prices และ Backup พร้อม sidebar, topbar, navigation, การ์ดราคา, KPI และแผงข้อมูล
- [x] ใช้ทองเมทัลลิกเป็นสีเน้น/CTA/ไอคอน พร้อมประกาย radial/เส้นเฉียงบนการ์ดราคา; ไม่ใช้โลโก้หรือโฆษณาในภาพอ้างอิง; คงแดงสำหรับ error/loss และเขียวสำหรับ gain
- [x] ใช้ตัวอักษรขาวนวลและเทาอ่อนบนพื้นเข้ม ตรวจ contrast; ปรับ focus ring และ hover ให้เห็นชัด
- [x] ขยาย Graphite/Gold ให้หน้า Holdings, Prices และ Backup ใช้ surfaces, forms, list rows, notices, buttons และ dialogs ที่สอดคล้องกับหน้า Overview โดยคงสีความหมาย gain/loss/error
- [x] ตรวจ Preview Desktop และ Mobile ทุกหน้า ว่า hierarchy, contrast, controls, bottom navigation และ touch layout อ่านชัดและไม่ล้น viewport

## Design และ QA ก่อนเผยแพร่
- [x] Add Gold Transaction พร้อมรูปทอง/ใบรับประกันในธีมทอง–แดง, responsive และ preview
- [x] ยืนยัน Preview Desktop/Mobile สำหรับการ์ดราคาและการวางสถานะการเชื่อมต่อแบบ compact
- [ ] ทำ manual WCAG 2.2 AA audit ครบ รวม keyboard/focus order, screen reader, contrast, touch target และ zoom 200%
- [ ] ทดสอบ Safari/iOS, Chrome/Android และอุปกรณ์ desktop จริง
- [ ] ทดสอบ warning ราคาเกิน 24 ชั่วโมงและไฟล์ import ผิดรูปแบบ
- [ ] วัด Core Web Vitals หลัง deploy จริง
- [ ] เผยแพร่เมื่อผู้ใช้อนุมัติเท่านั้น; ตอนนี้ยังไม่ publish

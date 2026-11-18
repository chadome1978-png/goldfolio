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

## Cloud Sync ใน BNK — อนุมัติขอบเขตแล้ว กำลังพัฒนา
- [ ] สร้าง additive migration เฉพาะ `public.goldfolio_*`; ห้ามอ่าน/แก้/ลบตารางหรือ records เดิมของ RoomRent
- [ ] เปิด RLS สำหรับตารางใหม่และถอน grants ของ `public`, `anon`, `authenticated`; ให้ server เท่านั้นเข้าฐานข้อมูลด้วย secret key
- [ ] สร้าง private bucket `goldfolio-attachments` พร้อม MIME allowlist (JPEG/PNG/WebP/PDF) และจำกัดไฟล์ไม่เกิน 5 MiB
- [ ] ใช้ Manus OAuth ตาม WebDev contract: ตรวจ `state`/nonce แบบ one-time, ตรวจ app session JWT, cookie `webdev_app_session`, derive `owner_id` จาก `openId` ที่ยืนยันแล้ว
- [ ] ป้องกัน API ด้วย auth; ทุก query บังคับ owner scope; ไม่รับ `owner_id` จาก client; secret key อยู่ฝั่ง server เท่านั้นและไม่เข้า GitHub/browser/log/response
- [ ] เพิ่มหน้า/สถานะบัญชีและ Cloud Sync: logged-in/out, sync off/on, เวลา sync ล่าสุด, pending/error/retry
- [ ] คง IndexedDB/JSON backup เป็น local/offline fallback; หาก upload/download ล้มเหลวต้องไม่ทำข้อมูล local หาย
- [ ] การ sign-in ครั้งแรกต้องยังไม่ upload local data อัตโนมัติ; แสดงจำนวน records/files และขอ user ยืนยันก่อน merge
- [ ] เมื่อยืนยันแล้ว ให้ merge holdings และรูปทอง/ใบรับประกันทั้งหมดกับ BNK; new CRUD/attachments sync เมื่อออนไลน์และผู้ใช้เปิด sync
- [ ] ใช้ `updatedAt` reconciliation, pending queue และ remote deletion tombstones เพื่อรองรับ offline/retry และหลายอุปกรณ์โดยไม่คืนรายการที่ลบแล้วโดยเงียบ ๆ
- [ ] Quote official เป็นข้อมูลสาธารณะและไม่จำเป็นต้อง sync; manual fallback ส่วนตัวเก็บ/sync ผ่าน preferences เมื่อผู้ใช้เปิด Cloud Sync เท่านั้น
- [ ] สร้าง/อัปเดต bucket โดยไม่เปิด public; upload/download/delete attachment ผ่าน authenticated server, ตรวจสิทธิ์เจ้าของทุกครั้ง
- [ ] ทดสอบ RLS/default deny, owner isolation ระหว่างผู้ใช้, OAuth callback/state, first-sync cancel/confirm, conflicts, tombstone delete, offline queue, private files และ legacy backups
- [ ] เก็บ service secret ผ่าน protected WebDev secret input; ห้ามแสดง/บันทึกค่า secret และห้าม push เข้าสู่ public GitHub
- [ ] Build, runtime smoke, Preview QA และยืนยัน config `database:false`, `auto_publish:false`; ไม่ publish จนผู้ใช้สั่ง

## ธีมที่ตรวจรอบก่อน — ทอง + น้ำเงิน (เฉพาะ Overview)
- [x] คงพื้น/การ์ดทองของหน้า Overview แต่เปลี่ยน accent จากแดงเป็นน้ำเงินเข้ม; ใช้น้ำเงินกับ active/brand/button accents และตัวอักษรขาวบนปุ่มน้ำเงิน
- [x] ตรวจ contrast ของน้ำเงินบนพื้นทอง/ครีมให้ผ่านระดับอ่านสบาย; คงแดงเฉพาะความหมายสถานะผิดพลาด/ขาดทุน ไม่เปลี่ยนสีของแท็บอื่น
- [x] ตรวจ Preview desktop และ mobile ว่า hierarchy, CTA, price status, navigation และ card accents ยังอ่านชัดและไม่ล้น viewport

## ธีมทดลองล่าสุด — Graphite + Metallic Gold (เฉพาะ Overview)
- [x] เปลี่ยนพื้นหน้า Overview, sidebar, topbar และ navigation เป็น charcoal/graphite ตามภาพอ้างอิง; เปลี่ยนพื้นผิวการ์ดราคา, KPI และแผงสัดส่วนสินทรัพย์เป็น graphite เข้ม
- [x] ใช้ทองเมทัลลิกเป็นสีเน้น/CTA/ไอคอน พร้อมประกาย radial/เส้นเฉียงบนการ์ดราคา; ไม่ใช้โลโก้หรือโฆษณาในภาพอ้างอิง; คงแดงสำหรับ error/loss และเขียวสำหรับ gain
- [x] ใช้ตัวอักษรขาวนวลและเทาอ่อนบนพื้นเข้ม ตรวจ contrast; ปรับ focus ring และ hover ให้เห็นชัด
- [x] ตรวจ Preview Desktop และ Mobile ว่าราคา สถานะเชื่อมต่อ ปุ่ม และ bottom navigation อ่านชัดและไม่ล้น; แท็บอื่นยังคงธีมเดิมจนกว่าจะยืนยันขยาย

## Design และ QA ก่อนเผยแพร่
- [x] Add Gold Transaction พร้อมรูปทอง/ใบรับประกันในธีมทอง–แดง, responsive และ preview
- [x] ยืนยัน Preview Desktop/Mobile สำหรับการ์ดราคาและการวางสถานะการเชื่อมต่อแบบ compact
- [ ] ทำ manual WCAG 2.2 AA audit ครบ รวม keyboard/focus order, screen reader, contrast, touch target และ zoom 200%
- [ ] ทดสอบ Safari/iOS, Chrome/Android และอุปกรณ์ desktop จริง
- [ ] ทดสอบ warning ราคาเกิน 24 ชั่วโมงและไฟล์ import ผิดรูปแบบ
- [ ] วัด Core Web Vitals หลัง deploy จริง
- [ ] เผยแพร่เมื่อผู้ใช้อนุมัติเท่านั้น; ตอนนี้ยังไม่ publish

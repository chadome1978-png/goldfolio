# ทองพอร์ต — แผนพัฒนาที่อนุมัติและสถาปัตยกรรมปัจจุบัน

## ขอบเขตผลิตภัณฑ์

แอปส่วนตัวสำหรับติดตามทองคำแท่งและทองรูปพรรณ 96.5% บนมือถือและ desktop ครอบคลุมจำนวน น้ำหนัก ราคาซื้อ วันที่ซื้อ ต้นทุนเพิ่มเติม มูลค่าประเมิน และกำไร/ขาดทุนโดยประมาณ Dashboard ใช้ราคาสมาคมค้าทองคำที่ proxy ผ่าน server

ผู้ใช้ยืนยันให้เก็บข้อมูลทองใน Supabase project **BNK** (`etsguakphlytlvzotmor`) และยืนยันให้รวมรูปทอง/ใบรับประกันด้วย ให้สร้างตารางและ bucket ชื่อเฉพาะ `goldfolio_*`; ห้ามอ่าน แก้ไข ลบ หรือย้ายข้อมูล/ตาราง/ไฟล์ของแอป RoomRent ที่อยู่ใน BNK อยู่แล้ว

## สถาปัตยกรรมที่อนุมัติ

- ใช้ Manus OAuth เป็นตัวระบุตัวผู้ใช้ แอปไม่สร้างระบบรหัสผ่านหรือ Supabase Auth เอง
- คง WebDev `server:true`, `database:false` (ไม่ใช้ฐานข้อมูลที่ WebDev จัดให้) และ `auto_publish:false`; ข้อมูลเก็บใน BNK ผ่าน Node server ของแอปเท่านั้น
- Browser ไม่เชื่อม Supabase โดยตรง และไม่มี service/secret key ใน bundle หรือ Git; ใช้ key ที่บันทึกผ่าน protected environment secret ของ WebDev เฉพาะ server เท่านั้น
- รายการทองและไฟล์แนบยังคง cache ใน IndexedDB และ export/import JSON ได้ เพื่อใช้งาน offline และเป็นข้อมูลสำรอง
- หลังผู้ใช้ยืนยันเปิด Cloud Sync ครั้งแรก ข้อมูลรายการทองที่มีอยู่และไฟล์แนบจะ merge ไปยัง BNK; ก่อนกดยืนยัน ห้ามอัปโหลดข้อมูลเดิมโดยอัตโนมัติ แม้ผู้ใช้ลงชื่อเข้าใช้แล้ว
- หลัง first sync consent สำเร็จ รายการที่เพิ่ม/แก้ไข/ลบใหม่จะ sync อัตโนมัติเมื่อออนไลน์และลงชื่อเข้าใช้; งานที่ยัง sync ไม่สำเร็จต้องคงใน local queue พร้อมสถานะที่เข้าใจได้
- initial merge และ sync รอบต่อไปใช้ `updatedAt` เพื่อเลือกรายการใหม่กว่า และเก็บ deletion tombstones เพื่อไม่คืนรายการที่ลบบนอีกอุปกรณ์โดยเงียบ ๆ; ห้ามแทนที่ข้อมูลทั้งฝั่ง local หรือ cloud แบบไม่มี consent
- คำขอราคา `/api/gold-prices` ไม่เปลี่ยนแปลง; quote ทางการเป็นข้อมูลสาธารณะและยัง cache ในอุปกรณ์ ไม่จำเป็นต้องส่งขึ้น BNK; ถ้ามี manual fallback ส่วนตัวให้ sync ผ่าน preferences เฉพาะเมื่อผู้ใช้เปิด Cloud Sync

## แบบจำลองข้อมูลและสิทธิ์

ใช้ตารางแยกเฉพาะแอป เช่น `public.goldfolio_holdings` สำหรับข้อมูลรายการ, owner, object paths, `updated_at` และ tombstone; `public.goldfolio_preferences` สำหรับค่าตั้งส่วนตัวที่จำเป็นต่อการซิงก์ (เช่น manual price fallback ถ้ามี) หลีกเลี่ยงการเก็บ bytes ของภาพใน JSONB

เปิด RLS บนตารางใหม่ และถอน grants จาก `public`, `anon`, `authenticated`; server API เข้าฐานข้อมูลด้วย key ฝั่ง server ซึ่ง bypasses RLS ดังนั้นทุก API ต้องตรวจ Manus session ก่อน แล้ว derive `owner_id` จาก `openId` ที่ตรวจสอบแล้วเท่านั้น—ห้ามรับ `owner_id` จาก request body/query และทุก select/upsert/delete ต้องกรอง owner ID เสมอ

สร้าง bucket `goldfolio-attachments` เป็น **private** สำหรับรูป JPEG/PNG/WebP และใบรับประกันภาพหรือ PDF; จำกัด MIME/ขนาดตามข้อกำหนดแอป ตั้ง object key ที่ไม่เผยชื่อไฟล์/ตัวระบุบัญชี และให้ server ตรวจสิทธิ์ก่อน upload/download/delete ไม่มี public URL หรือ direct client access

## UX ที่เพิ่มสำหรับ Cloud Sync

- เมนู “บัญชีและการซิงก์” แสดงสถานะ signed in/out, cloud sync off/on, เวลาซิงก์ล่าสุด และงานที่ยังรอ
- logged-out state มีปุ่มลงชื่อเข้าใช้ด้วย Manus OAuth; ไม่สร้าง preview user ปลอมและไม่ข้าม authentication ใน `NODE_ENV`
- หลัง sign-in ครั้งแรก แสดง preview จำนวนรายการและไฟล์แนบในเครื่อง/บนคลาวด์ แล้วให้ผู้ใช้ยืนยัน “รวมและซิงก์”; ถ้ายกเลิก ข้อมูลอยู่ในเครื่องเหมือนเดิมและยังไม่ส่งออกไป
- เมื่อ sync เสร็จแสดงสำเร็จ/ผิดพลาด พร้อม retry; การ logout ไม่ลบ IndexedDB หรือ cloud data
- รายละเอียดสินทรัพย์ยังเปิดภาพ/ใบรับประกันได้จาก local cache; การแก้ไขไฟล์ต้องส่งไฟล์ใหม่ผ่าน server หลังเปิด Cloud Sync

## ราคาสมาคมฯ และการคำนวณ (คงเดิม)

Server proxy อ่าน official endpoint `/api/GoldPrices/Details?readjson=false` เพราะ endpoint ไม่เปิด CORS สำหรับ browser; เลือก record ล่าสุดตาม `asTime` และส่งราคารับซื้อ/ขายออกทองแท่ง, ฐานภาษี/ขายออกทองรูปพรรณ, เวลาเผยแพร่และเวลาที่ดึงข้อมูล

โหลดราคาเมื่อเปิดแอปและทุก 2 นาทีขณะหน้าเปิดอยู่; คง manual fallback และ quote cache ในอุปกรณ์; Dashboard คำนวณผลใหม่ทันทีเมื่อได้รับ quote เปลี่ยน; เตือน quote เก่ากว่า 24 ชั่วโมง; ไม่กล่าวอ้างว่าเป็น tick-by-tick

ต้นทุนรวม = จำนวน × น้ำหนักต่อชิ้น × ราคาซื้อ + ต้นทุนเพิ่มเติม มูลค่าประเมิน = จำนวน × น้ำหนักต่อชิ้น × ราคารับซื้อทองแท่ง หรือฐานภาษีรูปพรรณ กำไร/ขาดทุนโดยประมาณ = มูลค่าประเมิน − ต้นทุนรวม ตัวเลขเป็นการประมาณ ไม่ใช่ราคาซื้อคืนที่รับประกัน

## Design system ที่ผู้ใช้เลือก

โครงหลักเดิมเป็น Dark Mode แดงทับทิม–ทอง; สำหรับคำขอล่าสุด ทดลองเปลี่ยน Overview เท่านั้นเป็น **พื้น/การ์ดสีทอง + accent สีน้ำเงินเข้ม**: พื้น `#D6AE3B`, surfaces `#F8EBC1`/`#EFE0A7`, navy `#103B70` และ blue `#174A7E`, ข้อความหลัก `#2B220F`, รอง `#4A3717`; ปุ่มน้ำเงินใช้ข้อความขาว ตรวจ contrast ก่อนจับภาพ และเก็บสีแดงไว้เฉพาะความหมายเชิงสถานะผิดพลาด/ขาดทุน แท็บอื่นคง theme เดิมจนกว่าจะขอขยาย UI ต้อง mobile-first มี contrast/focus/keyboard accessibility

## สแตกและโครงสร้างเป้าหมาย

React 19, TypeScript 7, Vite 8; Node.js HTTP server ให้ price proxy และ API auth/sync; ใช้ Supabase REST/Storage server-side โดยไม่ส่ง credential ไป frontend และไม่ใช้ WebDev managed database

- `server/server.mjs`: price endpoint, Manus OAuth callback/session, authenticated holdings/preferences/file API, health endpoint และ SPA/static fallback
- `server/manus-auth.mjs`: OAuth state+nonce, token exchange, verified user identity และ `webdev_app_session` cookie ตาม WebDev contract
- `server/supabase-client.mjs`: server-only Supabase fetch helper ที่อ่าน BNK secret จาก environment
- `src/features/sync/`: client sync state, first-sync consent, reconciliation, queue/retry
- `src/lib/storage/`: IndexedDB holdings, attachments, pending upserts/deletes, quote cache และ migration เดิมแบบไม่ทำข้อมูลหาย
- `supabase/migrations/`: additive DDL เฉพาะตาราง `goldfolio_*`, RLS/grants แบบ deny สำหรับ browser roles
- `public/manus-routes.json`: SPA route discovery; WebDev hybrid route config ส่ง `/api/*`/health เข้า Node และ UI เข้าสู่ static SPA
- `Dockerfile`: hybrid production server/runtime; ไม่มีการ publish ระหว่าง implementation/QA

## ไฟล์แนบและ backup

รูปทองและใบรับประกันยังบีบอัด/ตรวจ MIME และขนาดในฟอร์ม; IndexedDB/JSON backup เดิมยังใช้งานได้ การ Cloud Sync แปลงไฟล์แนบเป็น object ใน private bucket แล้วเก็บ path/metadata กับรายการ ไม่เก็บข้อมูล binary ใน record; restore จาก backup ยังคงทำได้และไม่ trigger cloud upload จนผู้ใช้เปิด sync/ยืนยันตาม flow

## Privacy, security และ rollout

ลิงก์สาธารณะ/เว็บไซต์ไม่ควร index (`noindex`); ผู้ใช้ที่ไม่มี session เห็นเฉพาะข้อมูลในอุปกรณ์ตัวเอง ไม่มี API สำหรับอ่านหรือเปลี่ยน owner อื่น; secret key มีอยู่ใน server environment เท่านั้นและไม่เขียนลงไฟล์, log, public GitHub หรือ response; Storage private; การเปิด Cloud Sync และ migration ข้อมูลเดิมต้องมี consent ชัดเจน

การสร้าง schema เป็น additive migration ใช้ namespace เฉพาะและตรวจชื่อก่อน; ตั้ง RLS/grants ปฏิเสธ direct client access แล้วทดสอบด้วย role ที่เกี่ยวข้อง; bucket/private access และ ownership ต้องตรวจ end-to-end ก่อนใช้กับข้อมูลจริง; auto-publish ปิดและยังไม่ publish

ดูรายละเอียด security ที่ `SUPABASE-SECURITY.md`, แหล่งราคา `PRICE-SOURCE.md`, และแผน/Checklist ที่ `BUILD-PLAN.md`; ราคาอัตโนมัติอัปเดตตามรอบประกาศสมาคมฯ ไม่ใช่ราคา tick-by-tick

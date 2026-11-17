# ทองพอร์ต — Build Plan และ Launch Checklist

**สถานะ:** strict TypeScript/Vite build, official-price parser fixtures, API/health/static smoke test และภาพ Preview desktop/mobile ผ่านแล้ว; config hybrid พร้อมใช้งาน · **ยังไม่เผยแพร่**
**ระยะเวลาเดิม:** แผนประมาณ 4 สัปดาห์นับจาก Discovery; ไม่มีวันเผยแพร่ที่กำหนด

**ขอบเขตระบบ:** server เปิดเพื่อ proxy ราคาสมาคมฯ เท่านั้น; `database` ปิด, holdings/ต้นทุน/attachments อยู่ IndexedDB ใน browser และ `auto_publish` ปิด. หน้า Dashboard ดึงราคาเมื่อเปิดแอปและทุก 2 นาทีระหว่างเปิดใช้งาน ไม่ใช่ราคา tick-by-tick

## Build Plan รายสัปดาห์

| สัปดาห์ | งาน | สถานะ/ผลลัพธ์ |
|---|---|---|
| 1 — Discovery, Strategy, Design | ยืนยันผู้ใช้ส่วนตัวและสิ่งที่ติดตาม; ออกแบบ Dashboard, holdings, quote, backup; ตรวจ API สมาคมฯ/CORS; อนุมัติธีมทอง–แดงและฟอร์มซื้อเข้า | **เสร็จแล้ว** — ขอบเขต local portfolio + public-price proxy ยืนยันแล้ว; auto-publish ยังปิด |
| 2 — Core App | Responsive shell, Dashboard, CRUD, รายละเอียดทอง, รูป/ใบรับประกัน, IndexedDB และ backup JSON | **เสร็จแล้ว** — flow CRUD และ attachments ทดสอบใน Preview ด้วยไฟล์ QA แล้วล้างข้อมูลจำลอง |
| 3 — ราคาและการคำนวณ | Node same-origin proxy, normalize record ล่าสุดจาก endpoint ทางการ, polling ทุก 2 นาที, manual fallback, Dashboard re-calculation และแสดงสถานะ/freshness | **เสร็จแล้ว** — official endpoint, parser และ auto-refresh ผ่าน smoke/regression checks; สถานะเชื่อมต่อถูกรวมเป็น badge ในการ์ดราคาทองและตรวจ desktop/mobile แล้ว |
| 4 — Optimize, QA และ Launch | ตรวจ Docker/container, error fallback, accessibility/device audit, Core Web Vitals และเผยแพร่หลังผู้ใช้อนุมัติ | **รอดำเนินการ** — config hybrid build/deploy/routes ประกาศไว้แล้ว; ยังไม่ publish, ไม่ได้วัด production CWV และยังไม่ทำ full WCAG/device audit |

## Launch Checklist

### เสร็จแล้ว

- [x] ยืนยันสถาปัตยกรรม quote proxy แบบจำกัดขอบเขต: server สำหรับดึงราคาสาธารณะเท่านั้น, `database: false`, `auto_publish: false`
- [x] Dashboard responsive พร้อมมูลค่า ต้นทุน กำไร/ขาดทุนโดยประมาณ น้ำหนัก สัดส่วน และสรุปประเภททอง
- [x] Holdings CRUD, หน้ารายละเอียด, รูปทอง/ใบรับประกันภาพหรือ PDF และ backup/restore local-only
- [x] สร้าง shared parser สำหรับ record ล่าสุดของ API ทางการ; mapping ฟิลด์ราคาและแปลง `asTime` เป็นเวลาไทย; ปฏิเสธ record ล่าสุดที่ผิดรูปแบบ/เวลาอนาคตแทนการย้อนไปใช้ราคาที่เก่ากว่า
- [x] เพิ่ม frontend auto-refresh เมื่อเปิดแอป/ทุก 2 นาทีขณะ visible, ปุ่ม refresh, error/stale state และ manual fallback
- [x] บันทึก quote ล่าสุดลง IndexedDB; ไม่ส่งข้อมูลรายการทอง ต้นทุน รูป หรือใบรับประกันไป server
- [x] WebDev hybrid build/deploy/routes กำหนดให้ health/API ไป server และ SPA ไป static; auto-publish ยังคงปิด
- [x] TypeScript/Vite production build ผ่าน; API endpoint จริงตอบกลับและบันทึกแหล่งข้อมูล/ข้อจำกัดใน `PRICE-SOURCE.md`
- [x] ตรวจ production Node smoke ที่ health/API/static route และตรวจ UI Preview 1280px/390px; สถานะเชื่อมต่อ/เวลา/รีเฟรชรวมกับส่วนราคาทอง

### ต้องทำก่อนเผยแพร่

- [ ] ทดสอบ upstream failure ผ่าน proxy จริงและยืนยันว่า quote ล่าสุดไม่หาย; parser fixture ปัจจุบันทดสอบ malformed/future record แต่ไม่แทนการทดสอบ outage จริง
- [ ] สร้างและรัน Docker image สำหรับ production container; smoke-test `/_app/health`, API และ SPA ภายใน container (ก่อนหน้านี้ทดสอบ Node server โดยตรงในเครื่องเท่านั้น)
- [ ] ตรวจ keyboard/focus, zoom 200%, screen-reader labels, contrast และ target size (WCAG 2.2 AA) บนมือถือ/desktop
- [ ] ทดสอบ Safari/iOS, Chrome/Android, storage quota, backup round-trip และ old backup compatibility
- [ ] วัด LCP < 2.5s, INP < 200ms, CLS < 0.1 หลังเลือก hostและตรวจบน production URL
- [ ] ให้ผู้ใช้ตรวจความหมาย source timestamp, manual fallback, stale/error states และฐานภาษีรูปพรรณ
- [ ] ขออนุมัติแยกก่อน publish; การเปิด server เพื่อ proxy ไม่ได้หมายถึงอนุมัติการเผยแพร่

## ขอบเขตและข้อควรทราบ

ข้อมูลรายการทอง/ต้นทุนและ attachments อยู่ใน IndexedDB ของอุปกรณ์ ไม่มีบัญชีหรือ cloud sync; server เห็นเฉพาะคำขอราคาอ้างอิงสาธารณะและไม่เก็บพอร์ต. ราคาใช้ record ล่าสุดที่สมาคมฯ เผยแพร่: ทองแท่งใช้ราคาซื้อคืน/รับซื้ออ้างอิง; ทองรูปพรรณใช้ฐานภาษีตามที่ประกาศ ไม่ใช่ราคาที่ร้านรับซื้อคืนรับประกัน. Dashboard ตรวจ endpoint ทุก 2 นาทีขณะเปิดแอป แต่สมาคมฯ เป็นผู้กำหนดจังหวะประกาศ จึงไม่ใช่ข้อมูลแบบ tick-by-tick. เมื่อ API ใช้ไม่ได้ แอปแสดงสถานะและคง quote ล่าสุดในอุปกรณ์.

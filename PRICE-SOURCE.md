# แหล่งราคาและการเชื่อมต่อในทองพอร์ต

แหล่งทางการ: [สมาคมค้าทองคำ](https://www.goldtraders.or.th/) และ API history ที่หน้าเว็บใช้: [`/api/GoldPrices/Details?readjson=false`](https://www.goldtraders.or.th/api/GoldPrices/Details?readjson=false)

ตรวจหน้าเว็บและ endpoint เมื่อ 17 พ.ย. 2569 (2026-11-17). หน้าเว็บแสดงราคาทองแท่ง 96.5% เป็นรับซื้อ/ขายออก และทองรูปพรรณ 96.5% เป็นฐานภาษี/ขายออก. Endpoint ส่ง JSON array ซึ่ง record มี `asTime`, `bL_BuyPrice`, `bL_SellPrice`, `oM965_BuyPrice` และ `oM965_SellPrice`. ใน response ที่ตรวจพบ 37 records; record ล่าสุดมีเวลา `2026-11-16T17:03:00` และ ID `88501`. ตัวอย่างนี้แสดงว่าต้องใช้ timestamp ของ record จริง ไม่ตีความว่า endpoint ทุกครั้งให้ราคาที่ประกาศวันนี้.

`asTime` เป็น wall-clock ของประกาศสมาคมฯ โดยไม่มี timezone suffix; แอปต้องตีความเป็น `Asia/Bangkok` (UTC+07:00) แล้วแปลงเป็น ISO ก่อนแสดง/คำนวณ. Field mapping: `bL_BuyPrice` → รับซื้อทองแท่ง; `bL_SellPrice` → ขายออกทองแท่ง; `oM965_BuyPrice` → ฐานภาษีทองรูปพรรณ; `oM965_SellPrice` → ขายออกทองรูปพรรณ. ราคาทั้งหมดเป็นบาทต่อบาททองคำ.

ตรวจพบว่า API ไม่ส่ง `Access-Control-Allow-Origin`, จึงให้ frontend เรียก same-origin `/api/gold-prices` ผ่าน Node server แทนการ fetch ข้าม origin. Development ใช้ middleware ใน Vite ที่เรียก helper เดียวกับ production; production container เรียก endpoint ทางการจาก server-side และส่งเฉพาะ quote ที่ normalize แล้วกลับ browser. Server cache เฉพาะ response ราคาชั่วคราวใน memory; ไม่มีฐานข้อมูลและไม่รับข้อมูล holdings.

Frontend จะเรียกเมื่อเปิดแอป, มีปุ่ม refresh และตรวจซ้ำทุก 2 นาทีขณะหน้าแอปเปิด. ใช้ `quotedAt` สำหรับเวลาประกาศจากสมาคมฯ และ `fetchedAt` สำหรับเวลาที่อ่าน endpoint สำเร็จ. เมื่อดึงไม่ได้ ให้เก็บ/แสดงราคาใน IndexedDB พร้อมสถานะว่าใช้ค่าล่าสุดที่เคยดึง; ข้อมูลพอร์ต รูปทอง และใบรับประกันไม่ออกจากอุปกรณ์.

ราคาประเมินไม่ได้รับประกันราคาขายคืนจริง. โดยเฉพาะราคาทองรูปพรรณ `oM965_BuyPrice` คือฐานภาษีอ้างอิง ไม่ใช่ราคาซื้อคืนที่ร้านรับประกัน. สมาคมฯ เป็นผู้กำหนดช่วง/จังหวะประกาศ จึงไม่ควรเรียกข้อมูลนี้ว่าราคา tick-by-tick.


**การตรวจความปลอดภัยของ record:** proxy เรียงตามเวลา `asTime` ก่อนตรวจความครบของ record ล่าสุด หาก record ล่าสุดขาดราคา/เวลาไม่ถูกต้อง หรือเวลาอนาคตเกิน tolerance 5 นาที จะปฏิเสธ response แทนการไหลย้อนกลับไปแสดงราคาที่เก่ากว่า; ราคาในอุปกรณ์ยังเป็น fallback ที่ UI ระบุสถานะไว้ชัดเจน.

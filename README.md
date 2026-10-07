# Ho Chi Minh Trip 2026

公開網站：https://maso20111210.github.io/hochiminh-trip-2026/

## 共享修改

1. 點「Google 登入」。任何已驗證的 Google 帳號都可以發布修改。
2. 點「開始編輯」，修改行程、備註、網址，或排序、刪除。
3. 點「完成編輯」會嘗試同步；也可直接點「同步存檔」。
4. 顯示「已同步到共享行程」才代表發布完成。朋友重新開啟、切回網站，或等待約 30 秒即可讀取新版。

本機草稿使用 localStorage，自動儲存不等於雲端發布。離線可看已快取行程，也可編輯；恢復連線後需點「同步存檔」。Google Maps 及登入需要網路。

有未同步草稿時，新共享版本不會覆蓋草稿。若版本衝突，請先匯出備份，再載入共享版本並重新套用修改。「載入共享版本」也會把舊草稿保存到 localStorage 的 `hcm_itinerary_supermarkets_v1_draft_backup`。

所有登入者都可修改，包括刪除行程；有連結的人不必登入就能查看。

## 網站程式更新

GitHub Pages：Deploy from a branch → main → /(root)。更新檔案並 commit 到 main，GitHub 會自動重新發布。

若改動快取資源，請同時更新 sw.js 的 CACHE 版本。所有部署路徑保持相對路徑。

雲端行程是目前共享資料來源；單改 index.html 的 original 陣列不會蓋掉已發布的雲端行程。行程内容應在網頁內編輯並同步，版面或功能才改 index.html。

## 同步程式

`cloud-sync.source.js` 是可維護原始碼，`cloud-sync.js` 是網頁使用的本機 bundle。

```sh
npm install
npm run build
```

不要把服務帳號金鑰、Google 存取權杖或其他秘密加入公開 repository。Firebase web config 是公開識別設定，存取控制由 firestore.rules 決定。

Firebase 專案：hochiminh-trip-2026-mei。Firestore Standard 預設資料庫，Spark 免費方案；未連結付費帳單。規則限制單一行程文件的讀取與登入後更新，不允許列出其他文件或刪除文件。修改 firestore.rules 檔案後，還必須在 Firebase 控制台部署規則才會生效。

PWA 可加入主畫面。首次在線上完整開啟後才有離線快取；離線時不會自動上傳修改。

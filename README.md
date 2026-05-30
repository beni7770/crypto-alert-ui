# Crypto Alert Agent

סוכן התראות קריפטו לניתוח צמדי USDT ב-Binance לפי Top Market Cap, עם מנוע ניתוח טכני, Telegram, Supabase ו-UI בעברית.

## Scripts

```bash
npm run dev
npm run build
npm run worker:once
npm run worker
npm run tracking:once
npm run backtest
npm run api
```

## Environment

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

MARKET_UNIVERSE_MODE=TOP_MARKET_CAP
MARKET_UNIVERSE_LIMIT=10

SYMBOL=BTCUSDT
SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT
LOW_INTERVAL=5m
HIGH_INTERVAL=1h
WORKER_INTERVAL_MS=300000
TRACKING_CANDLE_LIMIT=500
BACKTEST_ALERT_LIMIT=1000
DASHBOARD_ALERT_LIMIT=200
DASHBOARD_ANALYSIS_LIMIT=200
```

`SYMBOL` / `SYMBOLS` משמשים fallback אם CoinGecko או Binance לא זמינים.

## Supabase

לפני הפעלת שמירה לענן, הרץ את הסקריפט:

```sql
supabase.schema.sql
```

הטבלאות:

- `signal_analyses` - כל ניתוח שנוצר לכל צמד.
- `alerts` - התראות שנשלחו, כולל `alert_key` ייחודי למניעת כפילויות אחרי restart, מצב עסקה, TP/SL ותוצאת R.

## Tracking / Backtest

בכל מחזור worker המערכת בודקת התראות `TRADE` פתוחות מול נרות Binance ומעדכנת:

- `status`: פתוחה, TP1, TP2 או סגורה.
- `outcome`: TP1/TP2/TP3, סטופ, או סטופ אחרי יעד.
- `max_r` ו-`result_r`: תנועה מקסימלית ותוצאה בפועל ביחידות R.

להרצה ידנית:

```bash
npm run tracking:once
npm run backtest
```

## Dashboard

הפקודה `npm start` מפעילה גם את ה-worker וגם שרת API/UI:

- `GET /api/health` - בדיקת חיים.
- `GET /api/dashboard` - סיכום ביצועים, כרטיסי מצב והתראות אחרונות.
- `GET /api/dashboard` כולל גם `analytics` לפי צמד, כיוון, איכות סטאפ, מצב סטאפ, הקשר BTC ותוצאה.
- `GET /api/alerts` - רשימת התראות בלבד.

ה-UI קורא ל-API הזה ולא מחזיק `SUPABASE_SERVICE_ROLE_KEY` או מפתחות Telegram בצד הדפדפן.

אזור "ניתוח איכות המנוע" בדשבורד מציג Performance Breakdown, Top/Bottom לפי `Average R` ו-`Total R`, ומסמן קבוצות עם פחות מ-5 עסקאות סגורות כמדגם קטן.

## Alert Policy

Telegram שולח רק `LONG` / `SHORT` מאושרים עם תוכנית עסקה מלאה. `WATCHLIST`, `WAIT` וסיכומי "אין סיגנל" נשמרים/מוצגים במערכת אבל לא נשלחים לטלגרם.

ה-UI לא מחזיק מפתחות Telegram או Supabase. הוא מציג כרטיסי מצב דרך APIs ציבוריים בלבד.

## Deploy to Render

הפרויקט כולל `render.yaml` מוכן ל-Blueprint. ב-Render:

1. צור Blueprint חדש וחבר את הריפו `beni7770/crypto-alert-ui`.
2. בחר את branch `main`.
3. מלא את הערכים הסודיים שלא נשמרים בקוד:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. ודא שהפקודות הן:
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm start`
5. אחרי deploy מוצלח, פתח את הכתובת של Render:
   - `/` לדשבורד
   - `/api/health` לבדיקת חיים

Render מזריק את `PORT` אוטומטית, והשרת מאזין על `0.0.0.0`, לכן לא צריך להגדיר פורט ידנית.

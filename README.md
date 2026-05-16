# Crypto Alert Agent

סוכן התראות קריפטו לניתוח צמדי USDT ב-Binance לפי Top Market Cap, עם מנוע ניתוח טכני, Telegram, Supabase ו-UI בעברית.

## Scripts

```bash
npm run dev
npm run build
npm run worker:once
npm run worker
```

## Environment

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

MARKET_UNIVERSE_MODE=TOP_MARKET_CAP
MARKET_UNIVERSE_LIMIT=10
WATCHLIST_ALERT_MIN_QUALITY=HIGH

SYMBOL=BTCUSDT
SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT
LOW_INTERVAL=5m
HIGH_INTERVAL=1h
WORKER_INTERVAL_MS=300000
```

`SYMBOL` / `SYMBOLS` משמשים fallback אם CoinGecko או Binance לא זמינים.

## Supabase

לפני הפעלת שמירה לענן, הרץ את הסקריפט:

```sql
supabase.schema.sql
```

הטבלאות:

- `signal_analyses` - כל ניתוח שנוצר לכל צמד.
- `alerts` - התראות שנשלחו, כולל `alert_key` ייחודי למניעת כפילויות אחרי restart.

## Alert Policy

Telegram שולח:

- `LONG` / `SHORT` מאושרים.
- `WATCHLIST_LONG` / `WATCHLIST_SHORT` רק אם איכות הסטאפ עומדת ב-`WATCHLIST_ALERT_MIN_QUALITY`.

ה-UI לא מחזיק מפתחות Telegram או Supabase. הוא מציג כרטיסי מצב דרך APIs ציבוריים בלבד.

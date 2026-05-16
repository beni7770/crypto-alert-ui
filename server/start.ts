import "dotenv/config";

import { startApiServer } from "./api";
import { startWorker } from "./worker";

startApiServer();

startWorker().catch((error) => {
  console.error("שגיאה בהפעלת ה-worker:", error);
  process.exit(1);
});

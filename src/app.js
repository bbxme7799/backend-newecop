import express from "express";
import bodyParser from "body-parser";
import cookieSession from "cookie-session";
import config from "./config/index.js";
import morgan from "morgan";
import api from "./api/v1/index.js";
import cors from "cors";
import { NotFoundRequestException } from "./exceptions/not-found-request.exception.js";
import { errorHandlerMiddleware } from "./middlewares/error-handler.middleware.js";
import { hackerNewFetchAlltime } from "./schedules/hackerNewFetchAlltime.js";
import { hackerNewFetchToday } from "./schedules/hackerNewFetchToday.js";

const app = express();
// resetProductSchedule();
hackerNewFetchToday();
// hackerNewFetchAlltime();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(
  cookieSession({
    signed: false,
    secure: false,
  })
);

const whitelist = ["http://myservicestore.store","http://localhost:3000","http://www.myservicestore.store"];

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null,whitelist.includes(origin))
    },
    credentials: true,
  })
);

app.use("/api", api);
app.all("*", async (req, res, next) => {
  try {
    throw new NotFoundRequestException();
  } catch (error) {
    next(error);
  }
});

app.use(errorHandlerMiddleware);

app.listen(config.port, () => {
  console.log(process.env.NODE_ENV);
  console.log(`listening on port ${config.port}`);
  // console.log("For the UI, open http://localhost:8000/admin/queues");
});
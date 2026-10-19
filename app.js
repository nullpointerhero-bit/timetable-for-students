
"use strict";

// ========================================
// 1. Элементы интерфейса
// ========================================

const currentDateElement = document.getElementById("current-date");

const todayViewButton = document.getElementById("today-view");
const weekViewButton = document.getElementById("week-view");
const weekNavigation = document.getElementById("week-navigation");

const scheduleTitle = document.getElementById("schedule-title");
const lessonCount = document.getElementById("lesson-count");
const scheduleList = document.getElementById("schedule-list");

const addLessonButton = document.getElementById("add-lesson-button");
const backToTopButton = document.getElementById("back-to-top-button");

const lessonDialog = document.getElementById("lesson-dialog");
const lessonForm = document.getElementById("lesson-form");
const dialogTitle = document.getElementById("dialog-title");

const lessonIdInput = document.getElementById("lesson-id");
const lessonSubjectInput = document.getElementById("lesson-subject");
const lessonDayInput = document.getElementById("lesson-day");
const lessonStartInput = document.getElementById("lesson-start");
const lessonEndInput = document.getElementById("lesson-end");
const lessonTeacherInput = document.getElementById("lesson-teacher");
const lessonClassroomInput = document.getElementById("lesson-classroom");

const formError = document.getElementById("form-error");

const closeDialogButton = document.getElementById("close-dialog-button");
const cancelButton = document.getElementById("cancel-button");

const importDialog = document.getElementById("import-dialog");
const importForm = document.getElementById("import-form");
const importUrl = document.getElementById("import-url");
const importFile = document.getElementById("import-file");
const importDuration = document.getElementById("import-duration");
const importStatus = document.getElementById("import-status");

const weekToggleButton = document.getElementById("week-indicator");

document
    .getElementById("open-import-dialog")
    .addEventListener("click", () => {
        importStatus.textContent = "";
        importDialog.showModal();
    });

function closeImportDialog() {
    importDialog.close();
}

document
    .getElementById("close-import-dialog")
    .addEventListener("click", closeImportDialog);

document
    .getElementById("cancel-import-dialog")
    .addEventListener("click", closeImportDialog);

importForm.addEventListener("submit", async event => {
    event.preventDefault();

    const url = importUrl.value.trim();
    const file = importFile.files[0];
    const duration = Number(importDuration.value);

    if (!url && !file) {
        importStatus.textContent =
            "Укажи ссылку или выбери HTML-файл.";
        return;
    }

    if (!Number.isInteger(duration) || duration < 1 || duration > 240) {
        importStatus.textContent =
            "Длительность должна быть от 1 до 240 минут.";
        return;
    }

    try {
        importStatus.textContent = "Загружаю и анализирую расписание...";

        const importedLessons = file
            ? await importScheduleFromFile(file, duration)
            : await importScheduleFromUrl(url, duration);

        const confirmed = window.confirm(
            `Найдено занятий: ${importedLessons.length}.\n` +
            "Добавить их в существующее расписание?"
        );

        if (!confirmed) {
            importStatus.textContent = "Импорт отменён.";
            return;
        }

        const { added, skipped } =
            await saveImportedLessons(importedLessons);

        importStatus.textContent =
            `Импорт завершён. Добавлено: ${added}. ` +
            `Пропущено повторов: ${skipped}.`;

        importUrl.value = "";
        importFile.value = "";
    } catch (error) {
        console.error("Ошибка импорта расписания:", error);

        importStatus.textContent =
            error.message.includes("fetch") ||
                error.name === "TypeError"
                ? "Не удалось загрузить страницу. Возможно, сайт запрещает запросы из браузера (CORS). Попробуй сохранить страницу как HTML и импортировать файл."
                : `Ошибка импорта: ${error.message}`;
    }
});

// ========================================
// 2. Состояние приложения
// ========================================

const DAY_NAMES = [
    "воскресенье",
    "понедельник",
    "вторник",
    "среда",
    "четверг",
    "пятница",
    "суббота"
];

const DAY_NAMES_SHORT = [
    "вс", "пн", "вт", "ср", "чт", "пт", "сб"
];

let lessons = [];

let currentView = "today";
let selectedDay = new Date().getDay();

// Номер текущей учебной недели сохраняется между запусками.
// Понедельник первой учебной недели: 12 октября 2026 года.
const FIRST_WEEK_START = Date.UTC(2026, 9, 12);

const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function getCurrentWeek() {
    const now = new Date();

    // Используем календарную дату в локальном часовом поясе.
    const today = Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    // Определяем понедельник текущей недели.
    const weekday = new Date(today).getUTCDay();
    const daysSinceMonday = (weekday + 6) % 7;
    const currentWeekStart =
        today - daysSinceMonday * 24 * 60 * 60 * 1000;

    const weeksElapsed = Math.floor(
        (currentWeekStart - FIRST_WEEK_START) /
        MILLISECONDS_PER_WEEK
    );

    // Чередуем первую и вторую недели.
    return ((weeksElapsed % 2 + 2) % 2) + 1;
}

let selectedWeek = getCurrentWeek();

// ========================================
// 3. Вспомогательные функции
// ========================================

// Возвращает дату в удобном формате.
function formatDate(date) {
    return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        weekday: "long"
    }).format(date);
}

// Создаёт HTML-элемент с текстом.
// textContent не позволяет интерпретировать текст
// пользователя как HTML-код.
function createElement(tag, className, text = "") {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    element.textContent = text;

    return element;
}

// Сортирует занятия по времени начала.
function sortLessons(items) {
    return [...items].sort((a, b) => {
        return a.startTime.localeCompare(b.startTime);
    });
}

// Определяет, должна ли пара отображаться на выбранной неделе.
function isLessonForCurrentWeek(lesson) {
    const note = (lesson.note || "").toLocaleLowerCase("ru-RU");

    const week1 = /по\s+1\s+неделе/i.test(note);
    const week2 = /по\s+2\s+неделе/i.test(note);

    // Если указаны обе недели или ни одна, пара отображается всегда.
    if (week1 === week2) {
        return true;
    }

    return selectedWeek === 1 ? week1 : week2;
}

// Возвращает занятия выбранного дня с учётом недели.

// Возвращает занятия выбранного дня.
function getLessonsForDay(day) {
    return sortLessons(
        lessons.filter(lesson =>
            lesson.dayOfWeek === day &&
            isLessonForCurrentWeek(lesson)
        )
    );
}

// Показывает количество занятий.
function formatLessonCount(count) {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;

    let word = "занятий";

    if (lastTwoDigits < 11 || lastTwoDigits > 14) {
        if (lastDigit === 1) {
            word = "занятие";
        } else if (lastDigit >= 2 && lastDigit <= 4) {
            word = "занятия";
        }
    }

    return `${count} ${word}`;
}


// ========================================
// 4. Отображение даты
// ========================================

function renderCurrentDate() {
    const now = new Date();

    currentDateElement.textContent =
        new Intl.DateTimeFormat("ru-RU", {
            day: "numeric",
            month: "long",
            weekday: "long"
        }).format(now);
}


// ========================================
// 5. Создание карточки занятия
// ========================================

function createLessonCard(lesson) {
    const card = createElement("article", "lesson-card");

    // Время занятия.
    const time = createElement("div", "lesson-time");

    time.append(
        createElement("strong", "", lesson.startTime),
        createElement("span", "", lesson.endTime)
    );

    // Основная информация.
    const content = createElement("div", "lesson-content");

    const subject = createElement("h3", "", lesson.subject);
    content.append(subject);

    const meta = createElement("div", "lesson-meta");

    if (lesson.teacher) {
        meta.append(
            createElement("span", "", `♙ ${lesson.teacher}`)
        );
    }

    if (lesson.classroom) {
        meta.append(
            createElement("span", "", `⌖ ${lesson.classroom}`)
        );
    }

    if (meta.childElementCount > 0) {
        content.append(meta);
    }

    // Кнопки управления.
    // Кнопки управления парой и замечанием.
    const actions = createElement("div", "lesson-actions");

    const editButton = createElement("button", "", "✎");
    editButton.type = "button";
    editButton.setAttribute("aria-label", "Редактировать занятие");
    editButton.title = "Редактировать";
    editButton.addEventListener("click", () => {
        openEditDialog(lesson);
    });

    const deleteButton = createElement("button", "delete-button", "×");
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", "Удалить занятие");
    deleteButton.title = "Удалить";
    deleteButton.addEventListener("click", () => {
        removeLesson(lesson.id);
    });

    const noteButton = createElement("button", "lesson-note-button", "🗒️");
    noteButton.type = "button";
    noteButton.title = lesson.note
        ? "Просмотреть или изменить замечание"
        : "Добавить замечание";
    noteButton.setAttribute("aria-label", noteButton.title);

    if (lesson.note?.trim()) {
        noteButton.classList.add("has-note");
    }

    noteButton.addEventListener("click", event => {
        event.stopPropagation();
        openNoteDialog(lesson.id);
    });

    actions.append(editButton, deleteButton, noteButton);
    card.append(time, content, actions);

    return card;
}


// ========================================
// 6. Пустое расписание
// ========================================

function createEmptyState(message = "добавь первое занятие, чтобы заполнить расписание") {
    const empty = createElement("div", "empty-state");

    const icon = createElement("span", "empty-icon", "✳");
    icon.setAttribute("aria-hidden", "true");

    const heading = createElement("h3", "", "пока свободно");
    const description = createElement("p", "", message);

    empty.append(icon, heading, description);

    return empty;
}


// ========================================
// 7. Отображение одного дня
// ========================================

function renderDay(day, includeHeading = false) {
    const container = createElement("section", "day-section");

    container.id = `day-section-${day}`;

    if (includeHeading) {
        const heading = createElement(
            "h3",
            "day-heading",
            DAY_NAMES[day]
        );

        container.append(heading);
    }

    const dayLessons = getLessonsForDay(day);

    if (dayLessons.length === 0) {
        container.append(createEmptyState("на этот день занятий нет"));
        return container;
    }

    const list = createElement("div", "schedule-list");

    dayLessons.forEach(lesson => {
        list.append(createLessonCard(lesson));
    });

    container.append(list);

    return container;
}


// ========================================
// 8. Отображение расписания
// ========================================

function renderSchedule() {
    scheduleList.replaceChildren();

    if (currentView === "today") {
        const day = new Date().getDay();
        const dayLessons = getLessonsForDay(day);

        scheduleTitle.textContent = "сегодня";
        lessonCount.textContent = formatLessonCount(dayLessons.length);

        scheduleList.append(renderDay(day));

        return;
    }

    // В недельном режиме показываем все семь дней.
    scheduleTitle.textContent = "вся неделя";

    const visibleLessonCount = lessons.filter(
        isLessonForCurrentWeek
    ).length;

    lessonCount.textContent = formatLessonCount(visibleLessonCount);

    // Начинаем с понедельника.
    const weekOrder = [1, 2, 3, 4, 5, 6, 0];

    weekOrder.forEach(day => {
        scheduleList.append(renderDay(day, true));
    });
}


// ========================================
// 9. Переключение режимов
// ========================================

function setView(view) {
    currentView = view;

    const isToday = view === "today";

    todayViewButton.classList.toggle("active", isToday);
    weekViewButton.classList.toggle("active", !isToday);

    todayViewButton.setAttribute("aria-pressed", String(isToday));
    weekViewButton.setAttribute("aria-pressed", String(!isToday));

    weekNavigation.hidden = isToday;

    renderSchedule();
}

todayViewButton.addEventListener("click", () => {
    setView("today");
});

weekViewButton.addEventListener("click", () => {
    setView("week");
});

// Переключение между первой и второй учебными неделями.
function updateWeekButton() {
    const weekName = selectedWeek === 1
        ? "ПЕРВАЯ НЕДЕЛЯ"
        : "ВТОРАЯ НЕДЕЛЯ";

    weekToggleButton.textContent = weekName;
    weekToggleButton.title = "Неделя определяется автоматически по дате. Нажмите для изменения вручную";
}

function refreshSelectedWeek() {
    const currentWeek = getCurrentWeek();

    if (currentWeek !== selectedWeek) {
        selectedWeek = currentWeek;
        updateWeekButton();
        renderSchedule();
    }
}

updateWeekButton();

// Изменение недели самостоятельно.

weekToggleButton.addEventListener("click", () => {
    selectedWeek = selectedWeek === 1 ? 2 : 1;

    const weekName = selectedWeek === 1
        ? "первая неделя"
        : "вторая неделя";

    weekToggleButton.textContent = weekName;
    weekToggleButton.title = "Неделя определяется автоматически. Нажмите для ручного изменения";

    updateWeekButton();
    renderSchedule();
});

// Проверяем дату при возвращении на вкладку.
window.addEventListener("focus", refreshSelectedWeek);

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        refreshSelectedWeek();
    }
});

// Обновляем расписание, даже если вкладка всё время открыта.
setInterval(refreshSelectedWeek, 60_000);

updateWeekButton();


// ========================================
// 10. Навигация по дням недели
// ========================================

function updateDayNavigation() {
    const buttons = weekNavigation.querySelectorAll("[data-day]");

    buttons.forEach(button => {
        const day = Number(button.dataset.day);
        const isSelected = day === selectedDay;

        button.classList.toggle("active", isSelected);

        if (isSelected) {
            button.setAttribute("aria-current", "date");
        } else {
            button.removeAttribute("aria-current");
        }
    });
}

weekNavigation.querySelectorAll("[data-day]").forEach(button => {
    button.addEventListener("click", () => {
        selectedDay = Number(button.dataset.day);

        updateDayNavigation();

        const section = document.getElementById(
            `day-section-${selectedDay}`
        );

        section?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });
});


// ========================================
// 11. Открытие формы добавления
// ========================================

function openAddDialog() {
    lessonForm.reset();

    lessonIdInput.value = "";
    lessonDayInput.value = String(new Date().getDay());

    dialogTitle.textContent = "новый урок";

    clearFormError();

    lessonDialog.showModal();

    lessonSubjectInput.focus();
}

addLessonButton.addEventListener("click", openAddDialog);

backToTopButton.addEventListener("click", () => {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});


// ========================================
// 12. Открытие формы редактирования
// ========================================

function openEditDialog(lesson) {
    lessonForm.reset();

    lessonIdInput.value = String(lesson.id);
    lessonSubjectInput.value = lesson.subject;
    lessonDayInput.value = String(lesson.dayOfWeek);
    lessonStartInput.value = lesson.startTime;
    lessonEndInput.value = lesson.endTime;
    lessonTeacherInput.value = lesson.teacher || "";
    lessonClassroomInput.value = lesson.classroom || "";

    dialogTitle.textContent = "редактировать урок";

    clearFormError();

    lessonDialog.showModal();

    lessonSubjectInput.focus();
}


// ========================================
// 13. Закрытие формы
// ========================================

function closeDialog() {
    lessonDialog.close();
}

closeDialogButton.addEventListener("click", closeDialog);
cancelButton.addEventListener("click", closeDialog);


// ========================================
// 14. Сообщения об ошибках
// ========================================

function showFormError(message) {
    formError.textContent = message;
    formError.hidden = false;
}

function clearFormError() {
    formError.textContent = "";
    formError.hidden = true;
}


// ========================================
// 15. Проверка данных формы
// ========================================

function getLessonFromForm() {
    const subject = lessonSubjectInput.value.trim();
    const dayOfWeek = Number(lessonDayInput.value);
    const startTime = lessonStartInput.value;
    const endTime = lessonEndInput.value;
    const teacher = lessonTeacherInput.value.trim();
    const classroom = lessonClassroomInput.value.trim();

    if (!subject) {
        throw new Error("укажи название предмета.");
    }

    if (!Number.isInteger(dayOfWeek) ||
        dayOfWeek < 0 ||
        dayOfWeek > 6) {
        throw new Error("выбери корректный день недели.");
    }

    if (!startTime || !endTime) {
        throw new Error("укажи время начала и окончания урока.");
    }

    if (startTime >= endTime) {
        throw new Error("окончание урока должно быть позже её начала.");
    }

    return {
        subject,
        dayOfWeek,
        startTime,
        endTime,
        teacher,
        classroom
    };
}


// ========================================
// 16. Сохранение занятия
// ========================================

lessonForm.addEventListener("submit", async event => {
    event.preventDefault();

    clearFormError();

    try {
        const lesson = getLessonFromForm();
        const existingId = lessonIdInput.value;

        if (existingId !== "") {
            lesson.id = Number(existingId);

            await updateLesson(lesson);
        } else {
            await addLesson(lesson);
        }

        await refreshLessons();

        closeDialog();
    } catch (error) {
        console.error("Ошибка сохранения занятия:", error);

        showFormError(
            error.message || "не удалось сохранить занятие. попробуй ещё раз."
        );
    }
});


// ========================================
// 17. Удаление занятия
// ========================================

async function removeLesson(id) {
    const lesson = lessons.find(item => item.id === id);

    if (!lesson) {
        return;
    }

    const confirmed = window.confirm(
        `удалить занятие «${lesson.subject}»?`
    );

    if (!confirmed) {
        return;
    }

    try {
        await deleteLesson(id);

        await refreshLessons();
    } catch (error) {
        console.error("Ошибка удаления занятия:", error);

        window.alert("не удалось удалить занятие. попробуй ещё раз.");
    }
}


// ========================================
// 18. Загрузка данных
// ========================================

async function refreshLessons() {
    lessons = await getAllLessons();

    renderSchedule();
    updateDayNavigation();
}


// ========================================
// 19. Запуск приложения
// ========================================

async function initApp() {
    try {
        await openDatabase();

        renderCurrentDate();

        selectedDay = new Date().getDay();

        updateDayNavigation();

        await refreshLessons();

        setView("today");
    } catch (error) {
        console.error("Ошибка запуска приложения:", error);

        scheduleList.replaceChildren(
            createEmptyState(
                "не удалось открыть базу данных. проверь консоль браузера."
            )
        );

        window.alert(
            "не удалось загрузить расписание. попробуй перезагрузить страницу."
        );
    }
}

// 20. Замечания
const noteDialog = document.getElementById("note-dialog");
const noteTextarea = document.getElementById("lesson-note");
const saveNoteButton = document.getElementById("save-lesson-note");
const deleteNoteButton = document.getElementById("delete-lesson-note");
const closeNoteButton = document.getElementById("close-note-dialog");

let activeNoteLessonId = null;

// Открывает меню замечания для выбранной пары.
function openNoteDialog(lessonId) {
    const lesson = lessons.find(item => item.id === lessonId);

    if (!lesson) {
        return;
    }

    activeNoteLessonId = lessonId;
    noteTextarea.value = lesson.note || "";

    // Кнопка удаления нужна только при наличии замечания.
    deleteNoteButton.hidden = !lesson.note?.trim();

    noteDialog.showModal();
    noteTextarea.focus();
}

// Сохраняет текст замечания в существующей записи IndexedDB.
async function saveLessonNote() {
    if (activeNoteLessonId === null) {
        return;
    }

    const lesson = lessons.find(
        item => item.id === activeNoteLessonId
    );

    if (!lesson) {
        return;
    }

    const note = noteTextarea.value.trim();

    try {
        await updateLesson({
            ...lesson,
            note
        });

        // Обновляем данные в памяти приложения.
        const index = lessons.findIndex(
            item => item.id === activeNoteLessonId
        );

        if (index !== -1) {
            lessons[index] = {
                ...lessons[index],
                note
            };
        }

        noteDialog.close();
        renderSchedule();
    } catch (error) {
        console.error("Не удалось сохранить замечание:", error);
        alert("Не удалось сохранить замечание. Попробуй ещё раз.");
    }
}

// Удаляет замечание, не удаляя саму пару.
async function deleteLessonNote() {
    if (activeNoteLessonId === null) {
        return;
    }

    const lesson = lessons.find(
        item => item.id === activeNoteLessonId
    );

    if (!lesson) {
        return;
    }

    try {
        await updateLesson({
            ...lesson,
            note: ""
        });

        const index = lessons.findIndex(
            item => item.id === activeNoteLessonId
        );

        if (index !== -1) {
            lessons[index] = {
                ...lessons[index],
                note: ""
            };
        }

        noteDialog.close();
        renderSchedule();
    } catch (error) {
        console.error("Не удалось удалить замечание:", error);
        alert("Не удалось удалить замечание. Попробуй ещё раз.");
    }
}

saveNoteButton.addEventListener("click", saveLessonNote);
deleteNoteButton.addEventListener("click", deleteLessonNote);

closeNoteButton.addEventListener("click", () => {
    noteDialog.close();
});

// Обновляем видимость кнопки удаления при изменении текста.
noteTextarea.addEventListener("input", () => {
    deleteNoteButton.hidden = !noteTextarea.value.trim();
});

// 21. Импорт расписания

const IMPORT_DAYS = {
    "понедельник": 1,
    "вторник": 2,
    "среда": 3,
    "четверг": 4,
    "пятница": 5,
    "суббота": 6,
    "воскресенье": 0
};

function normalizeTime(value) {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);

    if (!match) {
        return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours > 23 || minutes > 59) {
        return null;
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addMinutes(time, duration) {
    const [hours, minutes] = time.split(":").map(Number);
    const total = hours * 60 + minutes + duration;

    if (total >= 24 * 60) {
        return null;
    }

    const endHours = Math.floor(total / 60);
    const endMinutes = total % 60;

    return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

function getCellLines(cell) {
    const container = document.createElement("div");

    container.innerHTML = cell.innerHTML.replace(
        /<br\s*\/?>/gi,
        "\n"
    );

    return (container.textContent || "")
        .split(/\n/)
        .map(line => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);
}

/**
 * Парсит HTML страницы по шаблону расписания из файла.
 * Возвращает массив объектов пар без идентификаторов БД.
 */
function parseUniversitySchedule(html, duration = 45) {
    const documentHtml = new DOMParser().parseFromString(
        html,
        "text/html"
    );

    const days = documentHtml.querySelectorAll(".day-div");
    const result = [];

    if (!days.length) {
        throw new Error(
            "Не найдено расписание подходящего формата."
        );
    }

    for (const dayElement of days) {
        const dayTitle = dayElement
            .querySelector(".day-title")
            ?.textContent
            ?.trim()
            .toLocaleLowerCase("ru-RU");

        const dayOfWeek = IMPORT_DAYS[dayTitle];

        if (dayOfWeek === undefined) {
            continue;
        }

        const rows = dayElement.querySelectorAll(
            ".day-table-row"
        );

        for (const row of rows) {
            const timeText = row
                .querySelector(".day-time .time_std")
                ?.textContent;

            const startTime = timeText
                ? normalizeTime(timeText)
                : null;

            const subjectCell = row.querySelector(".day-subject");

            if (!startTime || !subjectCell) {
                continue;
            }

            const lines = getCellLines(subjectCell);

            if (!lines.length) {
                continue;
            }

            // Пропускаем строки, которые обозначают перерыв.
            if (/^перерыв$/i.test(lines[0])) {
                continue;
            }

            // Сохраняем сведения о неделе, если они указаны.
            const weekNotes = lines.filter(line =>
                /^по\s+[12]\s+неделе$/i.test(line)
            );

            const contentLines = lines.filter(line =>
                !/^по\s+[12]\s+неделе$/i.test(line)
            );

            if (!contentLines.length) {
                continue;
            }

            const subject = contentLines[0];

            // В этом шаблоне аудитория и тип занятия находятся
            // в одной строке, например "лекция а.1-418".
            const locationIndex = contentLines.findIndex(line =>
                /^(?:лекция|лаб\.?|пр\.?)\s*/i.test(line)
            );

            const classroom = locationIndex !== -1
                ? contentLines[locationIndex]
                : "";

            const teacherLines = contentLines.filter(
                (line, index) =>
                    index !== 0 && index !== locationIndex
            );

            const teacher = teacherLines.join(", ");
            const endTime = addMinutes(startTime, duration);

            if (!endTime || endTime <= startTime) {
                continue;
            }

            result.push({
                subject,
                dayOfWeek,
                startTime,
                endTime,
                teacher,
                classroom,
                note: weekNotes.join("; ")
            });
        }
    }

    if (!result.length) {
        throw new Error(
            "Подходящие занятия не найдены. Проверь структуру HTML."
        );
    }

    return result;
}

async function importScheduleFromUrl(url, duration = 45) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Сайт вернул ошибку HTTP ${response.status}.`
        );
    }

    const html = await response.text();

    return parseUniversitySchedule(html, duration);
}

async function importScheduleFromFile(file, duration = 45) {
    const html = await file.text();

    return parseUniversitySchedule(html, duration);
}

function isDuplicateLesson(importedLesson) {
    return lessons.some(lesson =>
        lesson.dayOfWeek === importedLesson.dayOfWeek &&
        lesson.startTime === importedLesson.startTime &&
        lesson.subject === importedLesson.subject &&
        (lesson.teacher || "") === importedLesson.teacher &&
        (lesson.classroom || "") === importedLesson.classroom
    );
}

async function saveImportedLessons(importedLessons) {
    let added = 0;
    let skipped = 0;

    for (const lesson of importedLessons) {
        if (isDuplicateLesson(lesson)) {
            skipped++;
            continue;
        }

        const id = await addLesson(lesson);

        lessons.push({
            ...lesson,
            id
        });

        added++;
    }

    renderSchedule();

    return { added, skipped };
}

initApp();
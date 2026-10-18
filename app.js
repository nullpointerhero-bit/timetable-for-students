
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

// Возвращает занятия выбранного дня.
function getLessonsForDay(day) {
    return sortLessons(
        lessons.filter(lesson => lesson.dayOfWeek === day)
    );
}

// Показывает количество занятий.
function formatLessonCount(count) {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;

    let word = "пар";

    if (lastTwoDigits < 11 || lastTwoDigits > 14) {
        if (lastDigit === 1) {
            word = "пара";
        } else if (lastDigit >= 2 && lastDigit <= 4) {
            word = "пары";
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

    actions.append(editButton, deleteButton);

    card.append(time, content, actions);

    const noteButton = document.createElement("button");

    noteButton.type = "button";
    noteButton.className = "lesson-note-button";
    noteButton.textContent = "🗒️";
    noteButton.title = lesson.note
        ? "Просмотреть или изменить замечание"
        : "Добавить замечание";
    noteButton.setAttribute(
        "aria-label",
        noteButton.title
    );

    if (lesson.note?.trim()) {
        noteButton.classList.add("has-note");
    }

    noteButton.addEventListener("click", event => {
        event.stopPropagation();
        openNoteDialog(lesson.id);
    });

    card.append(noteButton);

    return card;
}


// ========================================
// 6. Пустое расписание
// ========================================

function createEmptyState(message = "добавь первую пару, чтобы заполнить расписание") {
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
    lessonCount.textContent = formatLessonCount(lessons.length);

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

    dialogTitle.textContent = "новая пара";

    clearFormError();

    lessonDialog.showModal();

    lessonSubjectInput.focus();
}

addLessonButton.addEventListener("click", openAddDialog);


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

    dialogTitle.textContent = "редактировать пару";

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
        throw new Error("укажи время начала и окончания пары.");
    }

    if (startTime >= endTime) {
        throw new Error("окончание пары должно быть позже её начала.");
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

initApp();
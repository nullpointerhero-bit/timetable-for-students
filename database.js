
const DB_NAME = "studentSchedule";
const DB_VERSION = 1;

let db;

// открытие базы данных
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // создание хранилища при первом запуске
        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            if (!database.objectStoreNames.contains("lessons")) {
                const store = database.createObjectStore("lessons", {
                    keyPath: "id",
                    autoIncrement: true
                });

                store.createIndex("dayOfWeek", "dayOfWeek", {
                    unique: false
                });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

// получение хранилища занятий
function getLessonsStore(mode = "readonly") {
    return db.transaction("lessons", mode).objectStore("lessons");
}

// получение всех занятий
function getAllLessons() {
    return new Promise((resolve, reject) => {
        const request = getLessonsStore().getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// добавление занятия
function addLesson(lesson) {
    return new Promise((resolve, reject) => {
        const request = getLessonsStore("readwrite").add(lesson);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// изменение занятия
function updateLesson(lesson) {
    return new Promise((resolve, reject) => {
        const request = getLessonsStore("readwrite").put(lesson);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// удаление занятия
function deleteLesson(id) {
    return new Promise((resolve, reject) => {
        const request = getLessonsStore("readwrite").delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

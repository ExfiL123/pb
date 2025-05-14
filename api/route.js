export async function GET(request) {
    // Генерируем случайную задачу для проверки человека
    const challenge = generateChallenge()

    return Response.json({
        challenge: challenge.question,
        challengeId: challenge.id,
    })
}

export async function POST(request) {
    try {
        const data = await request.json()
        const { challengeId, answer } = data

        // Проверяем ответ на задачу
        const isCorrect = verifyChallengeAnswer(challengeId, answer)

        if (isCorrect) {
            // Генерируем токен доступа
            const accessToken = generateAccessToken()
            return Response.json({ status: "success", accessToken })
        } else {
            return Response.json({ status: "failed", message: "Неверный ответ" }, { status: 403 })
        }
    } catch (error) {
        return Response.json({ error: "Ошибка обработки запроса" }, { status: 500 })
    }
}

// Хранилище задач (в реальном приложении лучше использовать базу данных)
const challenges = new Map()

function generateChallenge() {
    // Генерируем простую математическую задачу
    const a = Math.floor(Math.random() * 10) + 1
    const b = Math.floor(Math.random() * 10) + 1
    const operation = Math.random() > 0.5 ? "+" : "-"

    let answer
    let question

    if (operation === "+") {
        answer = a + b
        question = `Сколько будет ${a} + ${b}?`
    } else {
        answer = a - b
        question = `Сколько будет ${a} - ${b}?`
    }

    // Генерируем уникальный ID для задачи
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2)

    // Сохраняем задачу и ответ
    challenges.set(id, {
        answer,
        expires: Date.now() + 5 * 60 * 1000, // Задача действительна 5 минут
    })

    return {
        id,
        question,
    }
}

function verifyChallengeAnswer(challengeId, userAnswer) {
    if (!challenges.has(challengeId)) {
        return false
    }

    const challenge = challenges.get(challengeId)

    // Проверяем, не истек ли срок действия задачи
    if (challenge.expires < Date.now()) {
        challenges.delete(challengeId)
        return false
    }

    // Проверяем ответ
    const isCorrect = Number.parseInt(userAnswer) === challenge.answer

    // Удаляем задачу, чтобы ее нельзя было использовать повторно
    challenges.delete(challengeId)

    return isCorrect
}

function generateAccessToken() {
    // Генерируем токен доступа
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
}
  
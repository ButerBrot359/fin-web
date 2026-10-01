/**
 * Диалог выбора файла для эффекта `uploadFile`: одиночный файл, фильтр типов — серверный.
 *
 * Бэк присылает `accept` и `maxSizeBytes` в самом эффекте (фронт не знает, какой формат ждёт
 * конкретная команда), поэтому здесь нет ни одного «своего» ограничения — только исполнение.
 * Промис разрешается `null`, если пользователь закрыл диалог, не выбрав файл.
 */
export function pickFile(accept?: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.style.display = 'none'
    if (accept) input.accept = accept

    const finish = (file: File | null): void => {
      input.remove()
      resolve(file)
    }

    input.addEventListener('change', () => {
      finish(input.files && input.files.length > 0 ? input.files[0] : null)
    })
    // Отмена диалога не даёт change: без этого промис никогда бы не разрешился,
    // и следующий вызов команды копил бы висящие input'ы в документе.
    input.addEventListener('cancel', () => {
      finish(null)
    })

    document.body.appendChild(input)
    input.click()
  })
}

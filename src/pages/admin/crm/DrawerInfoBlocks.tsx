// Инфо-блоки карточки клиента — реэкспорт из декомпозированных файлов:
// - drawerInfoShared.tsx           — общие типы/утилиты (InfoBlocksProps, useInfoBlock, AddRowInline)
// - DrawerContactsAssignedBlocks.tsx — Контакты, Ответственные, подвал «Создано через»
// - DrawerObjectDatesBlocks.tsx      — Объект, Даты
// - DrawerMiscBlocks.tsx             — Касания, Заметки, Файлы, Причина отказа
export { DrawerFooterInfo, DrawerContactsBlock, DrawerAssignedRolesBlock } from "./DrawerContactsAssignedBlocks";
export { DrawerObjectBlock, DrawerDatesBlock } from "./DrawerObjectDatesBlocks";
export { DrawerCallDatesBlock, DrawerNotesBlock, DrawerFilesBlock, DrawerCancelBlock } from "./DrawerMiscBlocks";

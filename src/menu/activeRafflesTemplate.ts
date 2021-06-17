import { MenuTemplate, createBackMainMenuButtons } from 'telegraf-inline-menu'
import { SessionContext } from '../context/context'
import { RafflesModel } from '../models/rafflesModel'
import { dateFormatter } from '../utils/dateFormatter'

const rafflesModel = new RafflesModel()

const ENTRIES_PER_PAGE = 4

async function getAllEntries(context: SessionContext) {
  // Getting active raffles list
  const raffles = await rafflesModel.getActiveRaffles(context.from?.id!)

  /* 
    * Structure
    * id {raffle id}: 'Work name'
    */
  const entries: Record<string, string> = {}

  // Generating entries
  for (const [key, value] of Object.entries(raffles)) {
    let raffle = value
    entries['id' + raffle.id] = raffle.work_name
  }

  return entries
}

// Generating menu body
async function menuBody(context: SessionContext): Promise<string> {
  const raffles = await rafflesModel.getActiveRaffles(context.from?.id!)

  // If no active raffles
  if (Object.keys(raffles).length == 0) {
    return '*Активных раффлов на данный момент нету*'
  }

  const rafflesObj = raffles
  const pageIndex = (context.session.currentRafflesPage ?? 1) - 1
  const allEntries = await getAllEntries(context)

  rafflesObj.length = Object.keys(allEntries).length;
  const currentPageEntries = Array.prototype.slice.call(rafflesObj, pageIndex * ENTRIES_PER_PAGE, (pageIndex + 1) * ENTRIES_PER_PAGE);

  let text = `[[${pageIndex + 1}/${Math.ceil(Object.keys(allEntries).length / ENTRIES_PER_PAGE)}]]\n` // Page number
  text += '*Список активных раффлов*\n\n'

  for (const [key, value] of Object.entries(currentPageEntries)) {
    text += `*${value.work_name}* ${value.userStatus == 0 ? '🚫' : '✅'}\n`
    text += `_Доход:_ `
    if (value.profit !== '') {
      text += `${value.profit}₽\n`
    } else {
      text += `-\n`
    }
    text += `_До:_ ${dateFormatter(value.close_date)}\n`
    text += `\n`
  }

  return text
}

const activeRafflesTemplate = new MenuTemplate<SessionContext>(async context => {
  if (context.session.currentRafflesPage === undefined) {
    context.session.currentRafflesPage = 1
  }

  const text = await menuBody(context)
  return { text, parse_mode: 'Markdown' }
})


const detailsMenuTemplate = new MenuTemplate<SessionContext>(async ctx => {
  // Getting raffle id
  const id = parseInt(ctx.match![1].slice(2))

  // Setting current opened raffle id into session
  ctx.session.currentRafflesId = id

  // Getting raffle via API
  const raffle = await rafflesModel.getRaffle(id, ctx.from?.id!)

  ctx.session.currentRafflesStatus = raffle.userStatus ? true : false

  let text = `*${raffle.work_name}*\n`
  text += `${raffle.message}\n\n`


  text += `_До:_ ${dateFormatter(raffle.close_date)}\n`
  text += `_Размеры:_ `
  if (raffle.profit !== '') {
    text += `${raffle.sizes}\n`
  } else {
    text += `-\n`
  }

  text += `_Доход:_ `
  if (raffle.profit !== '') {
    text += `${raffle.profit}₽\n\n`
  } else {
    text += `-\n\n`
  }
  text += `_Ссылка на регистрацию:_\n${raffle.link}\n`

  if (raffle.images.length > 0) {
    return {
      type: 'photo',
      media: raffle.images,
      text,
      parse_mode: 'Markdown'
    }
  } else {
    return {
      text,
      parse_mode: 'Markdown'
    }
  }
})

// Adding entries menu
activeRafflesTemplate.chooseIntoSubmenu('details', getAllEntries, detailsMenuTemplate, {
  maxRows: 2,
  columns: ENTRIES_PER_PAGE / 2,
  getCurrentPage: context => context.session.currentRafflesPage
})

// Particiaption button
detailsMenuTemplate.toggle('Участвую', 'raffle_reg', {
  set: async (ctx, newState) => {
    // Sending new status to API
    await rafflesModel.setRartRaffle(newState, ctx.session.currentRafflesId, ctx.from?.id!)

    ctx.session.currentRafflesStatus = newState
    return true
  },
  isSet: (ctx) => ctx.session.currentRafflesStatus
})

detailsMenuTemplate.manualRow(createBackMainMenuButtons('🔙 Назад', ''))

// Pagination buttons
async function getCustomPaginationButtons(context: any) {
  const allEntries = await getAllEntries(context)

  if (Object.keys(allEntries).length === 0 || Object.keys(allEntries).length <= ENTRIES_PER_PAGE) {
    return []
  }

  if (context.session.currentRafflesPage === 1) {
    return [[{ text: '▶️', relativePath: `custom-pagination:${context.session.currentRafflesPage + 1}` }]]
  }
  if (context.session.currentRafflesPage === Math.ceil(Object.keys(allEntries).length / ENTRIES_PER_PAGE)) {
    return [[{ text: '◀️', relativePath: `custom-pagination:${context.session.currentRafflesPage - 1}` }]]
  }
  return [[{ text: '◀️', relativePath: `custom-pagination:${context.session.currentRafflesPage - 1}` }, { text: '▶️', relativePath: `custom-pagination:${context.session.currentRafflesPage + 1}` }]]
}

// Custom pagination
activeRafflesTemplate.manualRow(getCustomPaginationButtons)
activeRafflesTemplate.manualAction(/custom-pagination:(\d+)$/, (context, path) => {
  context.session.currentRafflesPage = parseInt(context.match![1])
  return '.'
})


activeRafflesTemplate.manualRow(createBackMainMenuButtons('🔙 Назад', ''))

export { activeRafflesTemplate }

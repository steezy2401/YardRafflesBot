import { MenuTemplate, createBackMainMenuButtons } from 'telegraf-inline-menu'
import { SessionContext } from '../context/context'
import { RafflesModel } from '../models/rafflesModel'
import { dateFormatter } from '../utils/dateHelper'
const isImageUrl = require('is-image-url');

const rafflesModel = new RafflesModel()

const ENTRIES_PER_PAGE = 4

async function getAllEntries(context: SessionContext) {
  // Getting active raffles list
  const raffles = await rafflesModel.getActiveRaffles(context.from?.id!)

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

  const allEntries = await getAllEntries(context)
  
  if (context.session.currentRafflesPage === undefined || Math.ceil(Object.keys(allEntries).length / ENTRIES_PER_PAGE) < context.session.currentRafflesPage) {
    context.session.currentRafflesPage = 1
  }

  const rafflesObj = raffles
  const pageIndex = (context.session.currentRafflesPage ?? 1) - 1

  rafflesObj.length = Object.keys(allEntries).length;
  const currentPageEntries = Array.prototype.slice.call(rafflesObj, pageIndex * ENTRIES_PER_PAGE, (pageIndex + 1) * ENTRIES_PER_PAGE);


  let text = `[[${pageIndex + 1}/${Math.ceil(Object.keys(allEntries).length / ENTRIES_PER_PAGE)}]]\n` // Page number
  text += '*Список активных раффлов*\n\n'

  for (const [key, value] of Object.entries(currentPageEntries)) {
    text += `${value.userStatus == 0 ? '🔴' : '🟢'} *${value.work_name}*\n`
    text += `_Доход:_ ${value.profit !== '' ? value.profit + '₽' : 'оговаривается'}\n`
    text += `_До:_ ${dateFormatter(value.close_date)}\n`
    text += `\n`
  }

  return text
}

const activeRafflesTemplate = new MenuTemplate<SessionContext>(async context => {
  return { text: await menuBody(context), parse_mode: 'Markdown' }
})


const detailsMenuTemplate = new MenuTemplate<SessionContext>(async ctx => {
  // Getting raffle id
  const id = parseInt(ctx.match![1].slice(2))

  ctx.session.currentRafflesId = id

  const raffle = await rafflesModel.getRaffle(id, ctx.from?.id!)

  ctx.session.currentRafflesStatus = raffle.userStatus ? true : false

  let text = `*${raffle.work_name}*\n`
  text += `${raffle.message}\n\n`


  text += `_До:_ ${dateFormatter(raffle.close_date)}\n`
  text += `_Размеры:_ ${raffle.profit !== '' ? raffle.sizes : '-'}\n`
  text += `_Доход:_ ${raffle.profit !== '' ? raffle.profit + '₽' : 'оговаривается'}\n`
  text += `_Ссылка на регистрацию:_\n${raffle.link}\n`

  const imageUrl = raffle.images.split('?')[0].trim()

  if (imageUrl.length > 0 && isImageUrl(imageUrl)) {
    return {
      type: 'photo',
      media: imageUrl,
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
  
  formatState: (context, text, state) => `${state ? '🚫 Не участвую' : '✅ Участвую'}`,
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

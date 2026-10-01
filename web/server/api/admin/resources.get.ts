import { getResourcesService } from '../../utils/admin-resources/runtime'
import { requireBotAdmin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await requireBotAdmin(event)
  return getResourcesService().getSnapshot()
})

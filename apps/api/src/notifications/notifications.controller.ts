import {
  Controller,
  Delete,
  Get,
  Patch,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { UpdatePrefsDto } from './dto/update-prefs.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  getNotifications(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getNotifications(
      req.user.sub,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch(':id/read')
  markRead(@Request() req, @Param('id') id: string) {
    return this.service.markRead(req.user.sub, id);
  }

  @Delete(':id')
  deleteNotification(@Request() req, @Param('id') id: string) {
    return this.service.deleteNotification(req.user.sub, id);
  }

  @Get('prefs')
  getPrefs(@Request() req) {
    return this.service.getPrefs(req.user.sub);
  }

  @Put('prefs')
  updatePrefs(@Request() req, @Body() dto: UpdatePrefsDto) {
    return this.service.updatePrefs(req.user.sub, dto);
  }
}

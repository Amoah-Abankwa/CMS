import { Body, Controller, Get, Patch } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';

class UpdatePreferencesDto {
  @IsOptional() @IsIn(['LIGHT', 'DARK', 'SYSTEM']) theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
  @IsOptional() @IsBoolean() sidebarCollapsed?: boolean;
}

@Controller('me/preferences')
export class PreferencesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@CurrentUser() user: AuthUser) {
    return (await this.prisma.userPreference.findUnique({ where: { userId: user.id } })) ?? { theme: 'SYSTEM', sidebarCollapsed: false };
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdatePreferencesDto) {
    return this.prisma.userPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...dto },
      update: dto,
      select: { theme: true, sidebarCollapsed: true },
    });
  }
}

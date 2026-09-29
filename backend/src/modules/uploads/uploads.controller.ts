import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { UploadsService } from './uploads.service';

class SignDto {
  @IsIn(['menu', 'hostel', 'profile']) purpose: 'menu' | 'hostel' | 'profile';
  @IsOptional() @IsUUID() targetId?: string;
}
class PhotoDto {
  @IsOptional() @IsString() @MaxLength(200) publicId?: string | null;
}
class PhotosDto {
  @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(200, { each: true }) publicIds: string[];
}

/** Signed image uploads. Ownership of the dish or hostel is checked in the service for every call. */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}
  @Post('sign') @HttpCode(200) sign(@CurrentUser() u: AuthUser, @Body() dto: SignDto) { return this.uploads.sign(u, dto.purpose, dto.targetId ?? ''); }
  @Put('profile-photo') profile(@CurrentUser() u: AuthUser, @Body() dto: PhotoDto) { return this.uploads.setProfilePhoto(u, dto.publicId ?? null); }
  @Put('menu-items/:id/photo') menu(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PhotoDto) { return this.uploads.setMenuPhoto(u, id, dto.publicId ?? null); }
  @Get('hostels/:id/photos') hostelPhotos(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.uploads.hostelPhotos(u, id); }
  @Put('hostels/:id/photos') hostel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PhotosDto) { return this.uploads.setHostelPhotos(u, id, dto.publicIds); }
}

import { Module } from '@nestjs/common';
import { OfferingsController } from './offerings.controller';
import { TeachingController } from './teaching.controller';
import { OfferingsService } from './offerings.service';

@Module({ controllers: [OfferingsController, TeachingController], providers: [OfferingsService], exports: [OfferingsService] })
export class OfferingsModule {}

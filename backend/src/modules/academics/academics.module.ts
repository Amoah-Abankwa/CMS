import { Global, Module } from '@nestjs/common';
import { AcademicsController } from './academics.controller';
import { SemestersService } from './semesters.service';

@Global()
@Module({ controllers: [AcademicsController], providers: [SemestersService], exports: [SemestersService] })
export class AcademicsModule {}

import { Module } from '@nestjs/common';
import { LibraryController, MyLibraryController } from './library.controller';
import { LibraryPolicyService } from './library-policy.service';
import { CatalogueService } from './catalogue.service';
import { CirculationService } from './circulation.service';
import { FinesService } from './fines.service';
import { BorrowerService } from './borrower.service';

@Module({
  controllers: [LibraryController, MyLibraryController],
  providers: [LibraryPolicyService, CatalogueService, CirculationService, FinesService, BorrowerService],
})
export class LibraryModule {}

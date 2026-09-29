import { LibraryExtrasController, MyLibraryExtrasController } from './library-extras.controller';
import { LibraryExtrasService } from './library-extras.service';
import { Module } from '@nestjs/common';
import { LibraryController, MyLibraryController } from './library.controller';
import { LibraryPolicyService } from './library-policy.service';
import { CatalogueService } from './catalogue.service';
import { CirculationService } from './circulation.service';
import { FinesService } from './fines.service';
import { BorrowerService } from './borrower.service';

@Module({
  controllers: [LibraryController, MyLibraryController, LibraryExtrasController, MyLibraryExtrasController],
  providers: [LibraryExtrasService, LibraryPolicyService, CatalogueService, CirculationService, FinesService, BorrowerService],
})
export class LibraryModule {}

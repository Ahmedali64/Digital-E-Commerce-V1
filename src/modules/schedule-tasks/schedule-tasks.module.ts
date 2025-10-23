import { Module } from '@nestjs/common';
import { ScheduledTasksService } from './schedule-tasks.service';
import { FilesModule } from '../files/files.module';

@Module({
  providers: [ScheduledTasksService],
  imports: [FilesModule],
})
export class ScheduleTasksModule {}

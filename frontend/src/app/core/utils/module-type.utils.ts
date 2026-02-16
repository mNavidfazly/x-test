import { LucideIconData, Video, FileText, Type, HelpCircle, ClipboardCheck, ExternalLink, Headphones, FolderArchive } from 'lucide-angular';

export interface ModuleTypeMeta {
  icon: LucideIconData;
  colorClass: string;
  label: string;
}

const MODULE_TYPE_META: Record<string, ModuleTypeMeta> = {
  video:         { icon: Video,          colorClass: 'text-violet-600 bg-violet-50',   label: 'Video' },
  pdf:           { icon: FileText,       colorClass: 'text-rose-600 bg-rose-50',       label: 'PDF' },
  markdown:      { icon: Type,           colorClass: 'text-blue-600 bg-blue-50',       label: 'Rich Text' },
  quiz:          { icon: HelpCircle,     colorClass: 'text-amber-600 bg-amber-50',     label: 'Quiz' },
  exam:          { icon: ClipboardCheck, colorClass: 'text-emerald-600 bg-emerald-50', label: 'Exam' },
  external_quiz: { icon: ExternalLink,   colorClass: 'text-purple-600 bg-purple-50',   label: 'External Quiz' },
  audio:         { icon: Headphones,     colorClass: 'text-teal-600 bg-teal-50',       label: 'Audio' },
  download:      { icon: FolderArchive,  colorClass: 'text-slate-600 bg-slate-100',    label: 'Downloadable Files' },
};

const DEFAULT_META: ModuleTypeMeta = { icon: FileText, colorClass: 'text-slate-600 bg-slate-100', label: 'Unknown' };

export function getModuleTypeMeta(type: string): ModuleTypeMeta {
  return MODULE_TYPE_META[type] ?? DEFAULT_META;
}

export function getModuleTypeIcon(type: string): LucideIconData {
  return (MODULE_TYPE_META[type] ?? DEFAULT_META).icon;
}

export function getModuleTypeLabel(type: string): string {
  return (MODULE_TYPE_META[type] ?? DEFAULT_META).label;
}

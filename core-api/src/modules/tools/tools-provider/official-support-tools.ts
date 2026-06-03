import { JobPriority, ToolCategory } from '@/common/enums/enum';
import type { Tool } from '../entities/tools.entity';

export const officialSupportTools: Tool[] = [
  {
    name: 'nessus',
    category: ToolCategory.VULNERABILITIES,
    description:
      "Nessus is the world's No. 1 vulnerability scanning solution that conducts comprehensive network vulnerability assessments and cloud security scanning with industry-leading accuracy.",
    logoUrl: '/static/images/nessus.png',
    command: 'nessus -h {{value}} -p 8834',
    version: '10.8.0',
    priority: JobPriority.HIGH,
  },
  {
    name: 'nmap-advanced',
    category: ToolCategory.PORTS_SCANNER,
    description:
      'Advanced network scanning with OS detection, script scanning, and service version detection for comprehensive network reconnaissance.',
    logoUrl: '/static/images/nmap.png',
    command: 'nmap -A -Pn -sV -sC -oX - {{value}}',
    version: '7.95',
    priority: JobPriority.MEDIUM,
  },
  {
    name: 'nikto-cms',
    category: ToolCategory.VULNERABILITIES,
    description:
      'Specialized CMS and web framework vulnerability scanner focusing on outdated software, configuration issues, and known vulnerabilities in popular platforms.',
    logoUrl: '/static/images/nikto.png',
    command: 'nikto -h {{value}} -o - -Format json',
    version: '2.5.0',
    priority: JobPriority.MEDIUM,
  },
];

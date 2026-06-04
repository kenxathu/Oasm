/* eslint-disable */

import type { Severity } from '@/common/enums/enum';
import { JobPriority, ToolCategory } from '@/common/enums/enum';
import { randomUUID } from 'crypto';
import { Asset } from '../../assets/entities/assets.entity';
import type { Vulnerability } from '../../vulnerabilities/entities/vulnerability.entity';
import { Tool } from '../entities/tools.entity';

export const builtInTools: Tool[] = [
  {
    name: 'subfinder',
    category: ToolCategory.SUBDOMAINS,
    description:
      'Subfinder is a subdomain discovery tool that returns valid subdomains for websites, using passive online sources.',
    logoUrl: '/static/images/subfinder.png',
    command:
      '(echo {{value}} && subfinder -duc -d {{value}}) | dnsx -duc -a -aaaa -cname -mx -ns -soa -txt -resp',
    parser: (result: string) => {
      const parsed = {};
      result.split('\n').forEach((line) => {
        const cleaned = line.replace(/\x1B\[[0-9;]*m/g, '').trim();
        const match = cleaned.match(/^([^\[]+)\s+\[([A-Z]+)\]\s+\[(.+)\]$/);
        if (!match) return;

        const [, domain, type, value] = match;
        if (!parsed[domain]) parsed[domain] = {};
        if (!parsed[domain][type]) parsed[domain][type] = [];
        parsed[domain][type].push(value);
      });

      return Object.keys(parsed).map((i) => ({
        id: randomUUID(),
        value: i,
        dnsRecords: parsed[i],
      })) as Asset[];
    },
    version: '2.8.0',
    priority: JobPriority.MEDIUM,
  },
  {
    name: 'httpx',
    category: ToolCategory.HTTP_PROBE,
    description:
      'Httpx is a fast and multi-purpose HTTP toolkit that allows running multiple probes using the retryable http library. It is designed to maintain result reliability with an increased number of threads.',
    logoUrl: '/static/images/httpx.png',
    command:
      'httpx -duc -u {{value}} -status-code -favicon -asn -title -web-server -irr -tech-detect -ip -cname -location -tls-grab -cdn -probe -json -follow-redirects -timeout 10 -threads 100 -silent',
    parser: JSON.parse,
    version: '1.7.1',
    priority: JobPriority.MEDIUM,
  },
  {
    name: 'screenshot',
    category: ToolCategory.SCREENSHOT,
    description: 'Take a screenshot of a website.',
    logoUrl: '/static/images/screenshot.png',
    parser: JSON.parse,
    version: '1.0.0',
    command: 'screenshot {{value}}',
    priority: JobPriority.MEDIUM,
  },
  {
    name: 'naabu',
    category: ToolCategory.PORTS_SCANNER,
    description:
      'A fast port scanner written in go with a focus on reliability and simplicity. Designed to be used in combination with other tools for attack surface discovery in bug bounties and pentests.',
    logoUrl: '/static/images/naabu.png',
    command: 'naabu -host {{value}} -silent',
    parser: (result: string) => {
      const parsed = result
        .trim()
        .split('\n')
        .filter((i) => i.includes(':'))
        .map((i) => Number(i.split(':')[1].replace(/\r/g, '')))
        .sort();
      return parsed;
    },
    version: '2.3.5',
    priority: JobPriority.MEDIUM,
  },
  {
    name: 'nuclei',
    category: ToolCategory.VULNERABILITIES,
    description:
      'Nuclei is a fast, customizable vulnerability scanner powered by the global security community and built on a simple YAML-based DSL, enabling collaboration to tackle trending vulnerabilities on the internet. It helps you find vulnerabilities in your applications, APIs, networks, DNS, and cloud configurations.',
    logoUrl: '/static/images/nuclei.png',
    command: 'nuclei -duc -u {{value}} -j --silent',
    parser: (result: string) => {
      const initialVulnerabilities = result
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const finding = JSON.parse(line.trim());
          const vulId = randomUUID();
          const filePath = `${vulId}.json`;
          return {
            id: vulId,
            name: finding['info']['name'] as string,
            description: finding['info']['description'] as string,
            severity: finding['info']['severity'].toLowerCase() as Severity,
            tags: finding['info']['tags'] || [],
            references: finding['info']['reference'] || [],
            authors: finding['info']['author'] || [],
            affectedUrl: finding['matched-at'] as string,
            ipAddress: finding['ip'] as string,
            host: finding['host'] as string,
            ports: [finding['port']?.toString()] as string[],
            cvssMetric: finding['info']['classification']?.[
              'cvss-metrics'
            ] as string,
            cvssScore: finding['info']['classification']?.[
              'cvss-score'
            ] as number,
            cveId: finding['info']['classification']?.['cve-id'] as string[],
            cweId: finding['info']['classification']?.['cwe-id'] as string[],
            extractorName: finding['extractor-name'] as string,
            extractedResults: finding['extracted-results'] || [],
            filePath,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      const groupedVulnerabilities = new Map<
        string,
        (typeof initialVulnerabilities)[0]
      >();

      for (const vuln of initialVulnerabilities) {
        if (groupedVulnerabilities.has(vuln.name)) {
          const existingVuln = groupedVulnerabilities.get(vuln.name)!;
          existingVuln.tags = [
            ...new Set([...existingVuln.tags, ...vuln.tags]),
          ];
          existingVuln.references = [
            ...new Set([...existingVuln.references, ...vuln.references]),
          ];
          existingVuln.authors = [
            ...new Set([...existingVuln.authors, ...vuln.authors]),
          ];
          existingVuln.extractedResults = [
            ...new Set([
              ...existingVuln.extractedResults,
              ...vuln.extractedResults,
            ]),
          ];
        } else {
          groupedVulnerabilities.set(vuln.name, { ...vuln });
        }
      }

      const data = Array.from(
        groupedVulnerabilities.values(),
      ) as Vulnerability[];
      return data;
    },

    version: '3.4.7',
    priority: JobPriority.LOW,
  },
  {
    name: 'nmap',
    category: ToolCategory.PORTS_SCANNER,
    description:
      'Nmap (Network Mapper) is a free and open-source network scanner used to discover hosts and services on a computer network. It sends specially crafted packets and analyzes the responses to identify open ports, services, and OS versions.',
    logoUrl: '/static/images/nmap.png',
    command: 'nmap -sV -sC -oX - {{value}} | cat',
    parser: (result: string | undefined) => {
      if (!result) return undefined;
      const ports: number[] = [];
      
      try {
        const lines = result.split('\n');
        for (const line of lines) {
          const match = line.match(/(\d+)\/(tcp|udp)\s+(open|closed|filtered)/);
          if (match) {
            const [, port] = match;
            ports.push(parseInt(port, 10));
          }
        }
      } catch (e) {
        // Silent fail for parsing errors
      }
      
      return ports.sort((a, b) => a - b);
    },
    version: '7.95',
    priority: JobPriority.MEDIUM,
  },
  {
    name: 'nikto',
    category: ToolCategory.VULNERABILITIES,
    description:
      'Nikto is an open source web server scanner which performs comprehensive tests against web servers for multiple items, including dangerous files and programs, outdated server software, configuration issues, and server misconfigurations.',
    logoUrl: '/static/images/nikto.png',
    command: 'nikto -h {{value}} -Format json',
    parser: (result: string) => {
      const vulnerabilities: Vulnerability[] = [];
      try {
        const jsonResult = JSON.parse(result);
        if (jsonResult.scan && Array.isArray(jsonResult.scan.details)) {
          for (const detail of jsonResult.scan.details) {
            if (detail.method && detail.description) {
              const vulId = randomUUID();
              vulnerabilities.push({
                id: vulId,
                name: `${detail.method} - ${detail.description}`.substring(0, 255),
                description: detail.description,
                severity: detail.severity?.toLowerCase() || 'info',
                references: detail.osvdb ? [`OSVDB-${detail.osvdb}`] : [],
                tags: [detail.method, 'nikto'],
                affectedUrl: `{{value}}${detail.uri || '/'}`,
                ipAddress: '{{value}}',
              } as Vulnerability);
            }
          }
        }
      } catch (e) {
        // Silent fail for parsing errors
      }
      return vulnerabilities;
    },
    version: '2.5.0',
    priority: JobPriority.LOW,
  },
];

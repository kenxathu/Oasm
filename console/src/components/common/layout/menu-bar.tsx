import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import AppLogo from '@/components/ui/app-logo';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { WorkspaceSwitcher } from '@/components/ui/workspace-switcher';
import {
  DEPENDENCY_TRACK_LATEST_RESULT_KEY,
  DEPENDENCY_TRACK_LATEST_RESULT_EVENT,
  getDependencyTrackLatestResult,
  getDependencyTrackStatus,
  type DependencyTrackLatestResult,
} from '@/services/apis/dependency-track';
import { useSession } from '@/utils/authClient';
import {
  Bug,
  CircleDot,
  CirclePlay,
  CloudCheck,
  Cpu,
  GlobeLock,
  Group,
  LayoutDashboard,
  Server,
  ShieldCheck,
  Sparkles,
  Target,
  User,
} from 'lucide-react';
import { NavUser } from '../../ui/nav-user';
import { NewBadge } from '../new-badge';

interface SubMenuItem {
  title: string;
  icon: React.ReactNode;
  url: string;
  isNew?: boolean;
}

interface NavGroup {
  title: string;
  url: string;
  items: SubMenuItem[];
  roles?: string[];
}

export const menu: NavGroup[] = [
    {
      title: 'Overview',
      url: '#',
      items: [
        {
          title: 'Dashboard',
          icon: <LayoutDashboard />,
          url: '/',
        },
        {
          title: 'Agents',
          icon: <Sparkles />,
          url: '/agents',
          isNew: true,
        },
      ],
    },
    {
      title: 'Admin',
      url: '#',
      roles: ['admin'],
      items: [
        {
          title: 'Users',
          icon: <User />,
          url: '/admin/users',
        },
      ],
    },
    {
      title: 'Attack surface',
      url: '#',
      items: [
        {
          title: 'Targets',
          icon: <Target />,
          url: '/targets',
        },
        {
          title: 'Groups',
          icon: <Group />,
          url: '/groups',
          isNew: false,
        },
        {
          title: 'Assets',
          icon: <CloudCheck />,
          url: '/assets',
        },
        {
          title: 'Internal networks',
          icon: <GlobeLock />,
          url: '/internal-networks',
        },
        {
          title: 'Dependency Track SBOM',
          icon: <ShieldCheck />,
          url: '/dependency-track',
        },
      ],
    },
    {
      title: 'Security',
      url: '#',
      items: [
        {
          title: 'Vulnerabilities',
          icon: <Bug />,
          url: '/vulnerabilities',
        },
        {
          title: 'Issues',
          icon: <CircleDot />,
          url: '/issues',
        },
      ],
    },

    {
      title: 'Management',
      url: '#',
      items: [
        {
          title: 'Tools',
          icon: <Cpu />,
          url: '/tools',
        },
        {
          title: 'Workers',
          icon: <Server />,
          url: '/workers',
        },
        {
          title: 'Jobs Registry',
          icon: <CirclePlay />,
          url: '/jobs',
        },
        
      ],
    },
  ];

function DependencyTrackMenuResult() {
  const { state, isMobile } = useSidebar();
  const [latestResult, setLatestResult] =
    React.useState<DependencyTrackLatestResult | null>(() =>
      getDependencyTrackLatestResult(),
    );

  const { data: status, isError } = useQuery({
    queryKey: ['dependency-track-status'],
    queryFn: getDependencyTrackStatus,
    retry: 1,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    const refresh = () => setLatestResult(getDependencyTrackLatestResult());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === DEPENDENCY_TRACK_LATEST_RESULT_KEY) refresh();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(DEPENDENCY_TRACK_LATEST_RESULT_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(DEPENDENCY_TRACK_LATEST_RESULT_EVENT, refresh);
    };
  }, []);

  const isExpanded = state === 'expanded' || isMobile;
  const serviceOnline = status?.status === 'ok' && !isError;
  const findingCount = latestResult?.vulnerabilities.length ?? 0;

  return (
    <span className="ml-auto flex items-center gap-1.5">
      <span
        aria-label={
          serviceOnline
            ? 'Dependency Track connected'
            : 'Dependency Track needs configuration'
        }
        className={`h-2 w-2 rounded-full ${
          serviceOnline ? 'bg-green-500' : 'bg-orange-500'
        }`}
      />
      {isExpanded && (
        <span className="rounded-full border border-border px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
          {findingCount}
        </span>
      )}
    </span>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { data } = useSession();

  return (
    <Sidebar {...props} collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between">
          <AppLogo type="large" />
        </div>
        {(state === 'expanded' || (state === 'collapsed' && isMobile)) && (
          <WorkspaceSwitcher />
        )}
      </SidebarHeader>
      <SidebarContent className="gap-1 md:gap-3">
        {menu
          .filter(
            (item) =>
              !item.roles ||
              item.roles.length === 0 ||
              (data?.user.role != null && item.roles.includes(data.user.role)),
          )
          .map((item) => (
            <SidebarGroup key={item.title} className="py-0">
              <SidebarGroupContent>
                <SidebarGroupLabel className="font-bold text-md">
                  {item.title}
                </SidebarGroupLabel>
                <SidebarMenu className="gap-0.5">
                  {item.items.map((item) => {
                    // Ensure all URLs are absolute for comparison
                    const toUrl = item.url;
                    const isActive =
                      `/${location.pathname.split('/')[1]}` === toUrl;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                          className="hover:cursor-pointer"
                        >
                          <Link
                            to={toUrl}
                            onClick={() => setOpenMobile(false)}
                            className="flex items-center justify-start w-full h-full text-base"
                          >
                            {item.icon} {item.title}{' '}
                            {item.isNew && <NewBadge />}
                            {item.url === '/dependency-track' && (
                              <DependencyTrackMenuResult />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
      </SidebarContent>
      <SidebarRail />
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}

import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { CommandPalette } from './components/CommandPalette';
import { GoldenHourDashboard } from './components/GoldenHourDashboard';
import { EvidenceVaultView } from './components/EvidenceVaultView';
import { EntityCorrelationView } from './components/EntityCorrelationView';
import { EntityGraphView } from './components/EntityGraphView';
import { TimelineView } from './components/TimelineView';
import { RiskExplainabilityView } from './components/RiskExplainabilityView';
import { AuditChainInspector } from './components/AuditChainInspector';
import { BriefGeneratorModal } from './components/BriefGeneratorModal';
import { NewCaseModal } from './components/NewCaseModal';
import type { Case, Evidence, Entity, EntityLink, Event, GraphData, EvidenceGap } from './types';
import { api } from './api/client';

export const App: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [activeCase, setActiveCase] = useState<Case | null>(null);

  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityLinks, setEntityLinks] = useState<EntityLink[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<Event[]>([]);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [evidenceGaps, setEvidenceGaps] = useState<EvidenceGap[]>([]);
  const [isChainValid, setIsChainValid] = useState<boolean>(true);

  // Navigation & Modal State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isInvestigationMode, setIsInvestigationMode] = useState<boolean>(false);
  const [selectedEntityForGraph, setSelectedEntityForGraph] = useState<Entity | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeCaseId) {
      loadCaseData(activeCaseId);
    }
  }, [activeCaseId]);

  const loadInitialData = async () => {
    try {
      const casesData = await api.getCases();
      setCases(casesData);
      if (casesData.length > 0) {
        setActiveCaseId(casesData[0].case_id);
        setActiveCase(casesData[0]);
      }
      const verifyRes = await api.verifyAuditChain();
      setIsChainValid(verifyRes.chain_valid);
    } catch (err) {
      console.error('Failed to load initial workspace data', err);
    }
  };

  const loadCaseData = async (caseId: string) => {
    try {
      const [caseDetail, evData, entData, linksData, timeData, gData, gapsData, verifyRes] = await Promise.all([
        api.getCase(caseId),
        api.getEvidence(caseId),
        api.getEntities(caseId),
        api.getEntityLinks(caseId),
        api.getTimeline(caseId),
        api.getGraph(caseId),
        api.getEvidenceGaps(caseId),
        api.verifyAuditChain()
      ]);

      setActiveCase(caseDetail);
      setEvidenceList(evData);
      setEntities(entData);
      setEntityLinks(linksData);
      setTimelineEvents(timeData);
      setGraphData(gData);
      setEvidenceGaps(gapsData);
      setIsChainValid(verifyRes.chain_valid);
    } catch (err) {
      console.error('Failed to load case data', err);
    }
  };

  const handleSelectCase = (caseId: string) => {
    setActiveCaseId(caseId);
  };

  const handleEvidenceUploaded = () => {
    if (activeCaseId) {
      loadCaseData(activeCaseId);
    }
  };

  const handleCaseCreated = async (newCaseId: string) => {
    const casesData = await api.getCases();
    setCases(casesData);
    setActiveCaseId(newCaseId);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!activeCaseId) return;
    try {
      const updated = await api.updateCaseStatus(activeCaseId, newStatus);
      setActiveCase(updated);
      setCases((prev) => prev.map((c) => (c.case_id === updated.case_id ? updated : c)));
    } catch (err) {
      console.error('Failed to update case status', err);
    }
  };

  const handleRefreshCorrelations = async () => {
    if (!activeCaseId) return;
    await api.recomputeCorrelations(activeCaseId);
    await loadCaseData(activeCaseId);
  };

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Bar (Hidden in full-screen Investigation Mode) */}
      {!isInvestigationMode && (
        <Navbar
          cases={cases}
          activeCaseId={activeCaseId}
          activeCase={activeCase}
          onSelectCase={handleSelectCase}
          onOpenNewCaseModal={() => setIsNewCaseModalOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          isChainValid={isChainValid}
          entities={entities}
          onSelectEntity={(ent) => {
            setSelectedEntityForGraph(ent);
            setActiveTab('graph');
          }}
        />
      )}

      {/* Main Body: Persistent Left Sidebar + Central Module View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Persistent Left Sidebar (Hidden in full-screen Investigation Mode) */}
        {!isInvestigationMode && (
          <Sidebar
            activeTab={activeTab}
            onSelectTab={(tab) => {
              if (tab === 'reports') {
                setIsReportModalOpen(true);
              } else {
                setActiveTab(tab);
              }
            }}
            evidenceCount={evidenceList.length}
            entitiesCount={entities.length}
            evidenceGapsCount={evidenceGaps.length}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          />
        )}

        {/* Central Investigation Viewport */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          {activeTab === 'dashboard' && (
            <GoldenHourDashboard
              currentCase={activeCase}
              cases={cases}
              entities={entities}
              evidenceGaps={evidenceGaps}
              evidenceCount={evidenceList.length}
              onOpenReportModal={() => setIsReportModalOpen(true)}
              onNavigateTab={setActiveTab}
              onSelectEntityForDrawer={(ent) => {
                setSelectedEntityForGraph(ent);
                setActiveTab('graph');
              }}
              onUpdateStatus={handleUpdateStatus}
            />
          )}

          {activeTab === 'vault' && activeCaseId && (
            <EvidenceVaultView
              evidenceList={evidenceList}
              activeCaseId={activeCaseId}
              onEvidenceUploaded={handleEvidenceUploaded}
            />
          )}

          {activeTab === 'entities' && (
            <EntityCorrelationView
              entities={entities}
              links={entityLinks}
              onRefreshCorrelations={handleRefreshCorrelations}
              onSelectEntityForGraph={(ent) => {
                setSelectedEntityForGraph(ent);
                setActiveTab('graph');
              }}
            />
          )}

          {activeTab === 'graph' && (
            <EntityGraphView
              graphData={graphData}
              onRefreshGraph={() => activeCaseId && loadCaseData(activeCaseId)}
              selectedEntity={selectedEntityForGraph}
              onSelectEntity={setSelectedEntityForGraph}
              isInvestigationMode={isInvestigationMode}
              onToggleInvestigationMode={() => setIsInvestigationMode(!isInvestigationMode)}
            />
          )}

          {activeTab === 'timeline' && (
            <TimelineView
              events={timelineEvents}
              isInvestigationMode={isInvestigationMode}
              onToggleInvestigationMode={() => setIsInvestigationMode(!isInvestigationMode)}
            />
          )}

          {activeTab === 'risk' && (
            <RiskExplainabilityView entities={entities} />
          )}

          {activeTab === 'audit' && (
            <AuditChainInspector />
          )}
        </main>
      </div>

      {/* Global Modals */}
      {activeCase && (
        <BriefGeneratorModal
          caseId={activeCase.case_id}
          caseTitle={activeCase.title}
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          currentCase={activeCase}
          entities={entities}
          evidenceList={evidenceList}
          evidenceGaps={evidenceGaps}
        />
      )}

      <NewCaseModal
        isOpen={isNewCaseModalOpen}
        onClose={() => setIsNewCaseModalOpen(false)}
        onCaseCreated={handleCaseCreated}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        cases={cases}
        activeCaseId={activeCaseId}
        onSelectCase={handleSelectCase}
        onSelectTab={(tab) => {
          if (tab === 'reports') {
            setIsReportModalOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        onOpenNewCaseModal={() => setIsNewCaseModalOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        entities={entities}
        onSelectEntity={(ent) => {
          setSelectedEntityForGraph(ent);
          setActiveTab('graph');
        }}
      />
    </div>
  );
};

export default App;

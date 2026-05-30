"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  ReactFlowInstance,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";

import { PersonNode } from "./PersonNode";
import { FamilyEdge } from "./FamilyEdge";
import { useFamilyTreeStore, useAuthStore } from "@/lib/store";
import { PersonNodeData, Person } from "@/lib/types";
import { computeTreeLayout } from "@/lib/utils";
import { ZoomIn, ZoomOut, Maximize2, Plus, Minus } from "lucide-react";
import { PersonSheet } from "@/components/person/PersonSheet";
import { PersonForm } from "@/components/person/PersonForm";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const nodeTypes = { personNode: PersonNode };
const edgeTypes = { familyEdge: FamilyEdge };

// Card geometry (must match PersonNode) — used to center the viewport on a node.
const CARD_W = 164;
const CARD_H = 190;

export default function FamilyCanvas() {
  const {
    tree,
    selectedPersonId,
    setSelectedPerson,
    setEditingPerson,
  } = useFamilyTreeStore();
  const { isAuthenticated, userId } = useAuthStore();

  const flowRef = useRef<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [detailPerson, setDetailPerson] = useState<Person | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editPerson, setEditPersonState] = useState<Person | null>(null);
  const [zoom, setZoom] = useState(0.7);

  const buildNodes = useCallback(
    (persons: Person[]): Node<PersonNodeData>[] => {
      const laidOut = computeTreeLayout(persons, tree.relationships);
      return laidOut.map((person) => ({
        id: person.id,
        type: "personNode",
        position: person.position ?? { x: 0, y: 0 },
        data: {
          person,
          isCurrentUser: person.id === userId,
          isDeceased: !!person.deathDate,
          isAuthenticated,
          onOpenDetail: (p: Person) => {
            setDetailPerson(p);
            setDetailOpen(true);
            setSelectedPerson(p.id);
          },
          onEdit: (p: Person) => {
            setEditPersonState(p);
            setEditOpen(true);
            setEditingPerson(p.id);
          },
        },
        draggable: isAuthenticated,
      }));
    },
    [tree.relationships, isAuthenticated, userId, setSelectedPerson, setEditingPerson]
  );

  const buildEdges = useCallback((): Edge[] => {
    return tree.relationships.map((rel) => ({
      id: rel.id,
      source: rel.personAId,
      target: rel.personBId,
      type: "familyEdge",
      data: { type: rel.type },
    }));
  }, [tree.relationships]);

  useEffect(() => {
    setNodes(buildNodes(tree.persons));
    setEdges(buildEdges());
  }, [tree, buildNodes, buildEdges, setNodes, setEdges]);

  // Smoothly recenter on the selected person
  useEffect(() => {
    if (selectedPersonId && flowRef.current) {
      const node = nodes.find((n) => n.id === selectedPersonId);
      if (node) {
        flowRef.current.setCenter(
          node.position.x + CARD_W / 2,
          node.position.y + CARD_H / 2,
          { zoom: 1.1, duration: 700 }
        );
      }
    }
  }, [selectedPersonId, nodes]);

  const handlePaneClick = useCallback(() => setSelectedPerson(null), [setSelectedPerson]);
  const handleFitView = useCallback(
    () => flowRef.current?.fitView({ padding: 0.2, duration: 600 }),
    []
  );
  const handleZoomIn = useCallback(() => flowRef.current?.zoomIn({ duration: 250 }), []);
  const handleZoomOut = useCallback(() => flowRef.current?.zoomOut({ duration: 250 }), []);

  const handleAddPerson = useCallback(() => {
    setEditPersonState(null);
    setEditOpen(true);
  }, []);

  const zoomPct = Math.round(zoom * 100);

  return (
    <div className="relative flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={handlePaneClick}
        onMove={(_, vp) => setZoom(vp.zoom)}
        onInit={(instance) => {
          flowRef.current = instance;
          instance.fitView({ padding: 0.2 });
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.15}
        maxZoom={2.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
        proOptions={{ hideAttribution: true }}
        elevateNodesOnSelect
        nodesConnectable={false}
        panOnScroll
        selectionOnDrag={false}
        zoomOnDoubleClick
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1.4}
          color="hsl(220, 14%, 88%)"
        />

        {/* ---------- Floating top toolbar (Excalidraw-style) ---------- */}
        <Panel position="top-center" className="!m-0 mt-4">
          <div className="glass animate-float-in flex items-center gap-1 rounded-2xl border border-white/60 p-1.5 shadow-lg">
            <ToolbarButton onClick={handleZoomOut} label="Dézoomer">
              <Minus className="h-4 w-4" />
            </ToolbarButton>
            <button
              onClick={handleFitView}
              className="min-w-[52px] rounded-lg px-2 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:bg-accent hover:text-primary"
            >
              {zoomPct}%
            </button>
            <ToolbarButton onClick={handleZoomIn} label="Zoomer">
              <Plus className="h-4 w-4" />
            </ToolbarButton>

            <div className="mx-1 h-5 w-px bg-border" />

            <ToolbarButton onClick={handleFitView} label="Recentrer">
              <Maximize2 className="h-4 w-4" />
            </ToolbarButton>

            {isAuthenticated && (
              <>
                <div className="mx-1 h-5 w-px bg-border" />
                <button
                  onClick={handleAddPerson}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter
                </button>
              </>
            )}
          </div>
        </Panel>

        {/* ---------- Compact legend ---------- */}
        <Panel position="bottom-left" className="m-4">
          <div className="glass flex items-center gap-3 rounded-xl border border-white/60 px-3 py-2 text-[11px] shadow-sm">
            <LegendItem color="hsl(var(--rel-parent))" label="Parent / Enfant" />
            <LegendItem color="hsl(var(--rel-sibling))" label="Fratrie" dashed />
            <LegendItem color="hsl(var(--rel-spouse))" label="Conjoint(e)" />
          </div>
        </Panel>

        {nodes.length === 0 && (
          <Panel position="top-center" className="mt-28">
            <div className="animate-float-in rounded-2xl border bg-card/90 p-8 text-center shadow-sm backdrop-blur-sm">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
                🌳
              </div>
              <h3 className="text-lg font-semibold">Arbre vide</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Aucune personne pour le moment.
              </p>
            </div>
          </Panel>
        )}

        <MiniMap
          nodeColor={(node) => {
            const data = node.data as PersonNodeData;
            if (data?.isCurrentUser) return "hsl(243, 75%, 59%)";
            if (data?.isDeceased) return "hsl(220, 10%, 75%)";
            return "hsl(243, 50%, 80%)";
          }}
          nodeBorderRadius={12}
          className="!rounded-xl !border !border-border !bg-white/70 !shadow-sm"
          maskColor="rgba(120,130,150,0.06)"
          pannable
          zoomable
        />
      </ReactFlow>

      {detailPerson && (
        <PersonSheet
          person={detailPerson}
          open={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setDetailPerson(null);
            setSelectedPerson(null);
          }}
          isAuthenticated={isAuthenticated}
          onEdit={(p) => {
            setEditPersonState(p);
            setEditOpen(true);
            setDetailOpen(false);
          }}
        />
      )}

      <Sheet
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingPerson(null);
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editPerson
                ? `Modifier ${editPerson.firstName} ${editPerson.lastName}`
                : "Ajouter une personne"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <PersonForm
              person={editPerson ?? undefined}
              onSuccess={() => {
                setEditOpen(false);
                setEditingPerson(null);
                setEditPersonState(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/70 transition-all hover:bg-accent hover:text-primary active:scale-90"
    >
      {children}
    </button>
  );
}

function LegendItem({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="block h-0.5 w-4 rounded-full"
        style={{
          backgroundColor: dashed ? "transparent" : color,
          borderTop: dashed ? `2px dotted ${color}` : undefined,
        }}
      />
      <span className="whitespace-nowrap text-muted-foreground">{label}</span>
    </div>
  );
}

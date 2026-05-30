"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  ReactFlowInstance,
  Panel,
  MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Plus,
  GitBranch,
  Undo2,
  Redo2,
  Upload,
  Hand,
} from "lucide-react";

import { PersonNode, CARD_W, CARD_H } from "./PersonNode";
import { FamilyEdge } from "./FamilyEdge";
import { useFamilyTreeStore, useAuthStore } from "@/lib/store";
import { PersonNodeData, Person } from "@/lib/types";
import { computeTreeLayout } from "@/lib/utils";
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

export default function FamilyCanvas() {
  const { tree, selectedPersonId, setSelectedPerson, setEditingPerson } =
    useFamilyTreeStore();
  const { isAuthenticated, userId } = useAuthStore();

  const flowRef = useRef<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [detailPerson, setDetailPerson] = useState<Person | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editPerson, setEditPersonState] = useState<Person | null>(null);
  const [zoom, setZoom] = useState(0.8);

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

  const buildEdges = useCallback(
    (): Edge[] =>
      tree.relationships.map((rel) => ({
        id: rel.id,
        source: rel.personAId,
        target: rel.personBId,
        type: "familyEdge",
        data: { type: rel.type },
      })),
    [tree.relationships]
  );

  useEffect(() => {
    setNodes(buildNodes(tree.persons));
    setEdges(buildEdges());
  }, [tree, buildNodes, buildEdges, setNodes, setEdges]);

  useEffect(() => {
    if (selectedPersonId && flowRef.current) {
      const node = nodes.find((n) => n.id === selectedPersonId);
      if (node) {
        flowRef.current.setCenter(
          node.position.x + CARD_W / 2,
          node.position.y + CARD_H / 2,
          { zoom: 1.1, duration: 650 }
        );
      }
    }
  }, [selectedPersonId, nodes]);

  const handleReset = useCallback(
    () => flowRef.current?.fitView({ padding: 0.2, duration: 600 }),
    []
  );
  const handleZoomIn = useCallback(() => flowRef.current?.zoomIn({ duration: 200 }), []);
  const handleZoomOut = useCallback(() => flowRef.current?.zoomOut({ duration: 200 }), []);

  return (
    <div className="relative flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={() => setSelectedPerson(null)}
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
        proOptions={{ hideAttribution: true }}
        panOnScroll
        zoomOnDoubleClick
        nodesConnectable={false}
        elevateNodesOnSelect
      >
        {/* Dot grid — matches canvas-grid utility */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={0.9}
          color="oklch(0.27 0.015 60 / 0.12)"
          className="!bg-canvas"
        />

        {/* ── Bottom pill toolbar ──────────────────────────────────────── */}
        <Panel position="bottom-center" className="!mb-6 !mx-0 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/90 p-1.5 shadow-float backdrop-blur-xl">

            {isAuthenticated && (
              <>
                <button
                  onClick={() => { setEditPersonState(null); setEditOpen(true); }}
                  className="flex h-9 items-center gap-2 rounded-full pl-2 pr-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted"
                >
                  <span className="grid size-6 place-items-center rounded-full bg-accent text-accent-foreground">
                    <Plus className="size-3.5" strokeWidth={2.5} />
                  </span>
                  Ajouter
                </button>
                <Divider />
                <ToolBtn label="Ajouter une relation"><GitBranch className="size-4" /></ToolBtn>
                <ToolBtn label="Importer GEDCOM"><Upload className="size-4" /></ToolBtn>
                <Divider />
                <ToolBtn label="Annuler"><Undo2 className="size-4" /></ToolBtn>
                <ToolBtn label="Rétablir"><Redo2 className="size-4" /></ToolBtn>
                <Divider />
              </>
            )}

            <ToolBtn label="Recentrer" onClick={handleReset}>
              <Hand className="size-4" />
            </ToolBtn>

            <div className="flex items-center">
              <button
                onClick={handleZoomOut}
                aria-label="Zoom arrière"
                className="grid size-9 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-muted"
              >
                −
              </button>
              <span className="w-12 text-center font-mono text-xs tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                aria-label="Zoom avant"
                className="grid size-9 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-muted"
              >
                +
              </button>
            </div>
          </div>
        </Panel>

        {/* Empty state */}
        {nodes.length === 0 && (
          <Panel position="top-center" className="mt-24">
            <div className="animate-float-in rounded-2xl border bg-card/90 p-8 text-center shadow-card backdrop-blur-sm">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-2xl">
                🌳
              </div>
              <h3 className="font-serif text-lg text-card-foreground">Arbre vide</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Aucune personne pour le moment.
              </p>
            </div>
          </Panel>
        )}

        <MiniMap
          nodeColor={(node) => {
            const d = node.data as PersonNodeData;
            if (d?.isCurrentUser) return "var(--color-accent)";
            if (d?.isDeceased) return "oklch(0.7 0 0)";
            return "oklch(0.85 0.04 55)";
          }}
          nodeBorderRadius={10}
          className="!rounded-xl !border !border-border !bg-card/80 !shadow-card"
          maskColor="oklch(0.27 0.015 60 / 0.04)"
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Detail sheet */}
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

      {/* Edit / create sheet */}
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

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" />;
}

function ToolBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

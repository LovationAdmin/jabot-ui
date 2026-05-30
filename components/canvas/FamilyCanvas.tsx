"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
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
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize, Trees } from "lucide-react";
import { PersonSheet } from "@/components/person/PersonSheet";
import { PersonForm } from "@/components/person/PersonForm";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const nodeTypes = {
  personNode: PersonNode,
};

const edgeTypes = {
  familyEdge: FamilyEdge,
};

export default function FamilyCanvas() {
  const {
    tree,
    selectedPersonId,
    setSelectedPerson,
    setEditingPerson,
    editingPersonId,
    getPersonById,
  } = useFamilyTreeStore();
  const { isAuthenticated, userId } = useAuthStore();

  const flowRef = useRef<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [detailPerson, setDetailPerson] = useState<Person | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editPerson, setEditPersonState] = useState<Person | null>(null);

  // Build nodes from persons
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

  // Build edges from relationships
  const buildEdges = useCallback((): Edge[] => {
    return tree.relationships.map((rel) => ({
      id: rel.id,
      source: rel.personAId,
      target: rel.personBId,
      type: "familyEdge",
      data: { type: rel.type },
      animated: rel.type === "spouse",
    }));
  }, [tree.relationships]);

  // Update nodes and edges when tree changes
  useEffect(() => {
    const newNodes = buildNodes(tree.persons);
    const newEdges = buildEdges();
    setNodes(newNodes);
    setEdges(newEdges);
  }, [tree, buildNodes, buildEdges, setNodes, setEdges]);

  // Focus on selected person
  useEffect(() => {
    if (selectedPersonId && flowRef.current) {
      const node = nodes.find((n) => n.id === selectedPersonId);
      if (node) {
        flowRef.current.setCenter(
          node.position.x + 100,
          node.position.y + 130,
          { zoom: 1.2, duration: 600 }
        );
      }
    }
  }, [selectedPersonId, nodes]);

  const handlePaneClick = useCallback(() => {
    setSelectedPerson(null);
  }, [setSelectedPerson]);

  const handleFitView = useCallback(() => {
    flowRef.current?.fitView({ padding: 0.1, duration: 500 });
  }, []);

  const handleZoomIn = useCallback(() => {
    flowRef.current?.zoomIn({ duration: 200 });
  }, []);

  const handleZoomOut = useCallback(() => {
    flowRef.current?.zoomOut({ duration: 200 });
  }, []);

  return (
    <div className="flex-1 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={handlePaneClick}
        onInit={(instance) => {
          flowRef.current = instance;
          instance.fitView({ padding: 0.15 });
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
        proOptions={{ hideAttribution: true }}
        className="bg-[hsl(40,25%,95%)]"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="hsl(38, 20%, 78%)"
        />

        {/* Custom controls panel */}
        <Panel position="bottom-right" className="flex flex-col gap-2 m-4">
          <Button
            size="icon"
            variant="outline"
            onClick={handleZoomIn}
            className="bg-white shadow-sm h-9 w-9"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={handleZoomOut}
            className="bg-white shadow-sm h-9 w-9"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={handleFitView}
            className="bg-white shadow-sm h-9 w-9"
          >
            <Maximize className="w-4 h-4" />
          </Button>
        </Panel>

        {/* Legend */}
        <Panel position="bottom-left" className="m-4">
          <div className="bg-white/90 backdrop-blur-sm border rounded-lg p-3 shadow-sm text-xs space-y-1.5">
            <p className="font-semibold text-xs text-muted-foreground mb-2">Légende</p>
            <div className="flex items-center gap-2">
              <div className="w-5 h-0.5 bg-primary" />
              <span className="text-muted-foreground">Parent / Enfant</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-0.5 border-t-2 border-dashed border-blue-500" />
              <span className="text-muted-foreground">Frère / Sœur</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-0.5 bg-rose-500" />
              <span className="text-muted-foreground">Conjoint(e)</span>
            </div>
          </div>
        </Panel>

        {/* Empty state */}
        {nodes.length === 0 && (
          <Panel position="top-center" className="mt-20">
            <div className="text-center space-y-3 bg-white/90 rounded-xl p-8 shadow-sm border">
              <Trees className="w-10 h-10 text-primary mx-auto" />
              <h3 className="font-semibold text-lg">Arbre généalogique vide</h3>
              <p className="text-muted-foreground text-sm">
                Aucune personne dans cet arbre pour le moment.
              </p>
            </div>
          </Panel>
        )}

        <Controls showInteractive={false} className="hidden" />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as PersonNodeData;
            if (data?.isCurrentUser) return "hsl(28, 80%, 45%)";
            if (data?.isDeceased) return "hsl(0, 0%, 70%)";
            return "hsl(38, 60%, 75%)";
          }}
          className="!bg-white/80 !border !rounded-lg"
          maskColor="rgba(0,0,0,0.05)"
          zoomable
          pannable
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

      {/* Edit sheet */}
      <Sheet
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingPerson(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editPerson
                ? `Modifier ${editPerson.firstName} ${editPerson.lastName}`
                : "Modifier la personne"}
            </SheetTitle>
          </SheetHeader>
          {editPerson && (
            <div className="mt-4">
              <PersonForm
                person={editPerson}
                onSuccess={() => {
                  setEditOpen(false);
                  setEditingPerson(null);
                  setEditPersonState(null);
                }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

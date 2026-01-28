import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import WorkflowService from '#services/workflow_service'

export default class WorkflowSeed extends BaseCommand {
  static commandName = 'workflow:seed'
  static description = 'Seed formalized BPMN definitions into Flowable'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const service = new WorkflowService()
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:flowable="http://flowable.org/bpmn" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC" xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI" targetNamespace="http://www.flowable.org/processdef">
  <process id="risk_sql_approval" name="Enterprise Risk SQL Approval" isExecutable="true">
    <startEvent id="startEvent" name="Start" />
    <sequenceFlow id="flow1" sourceRef="startEvent" targetRef="techReview" />
    <userTask id="techReview" name="Technical Review (DBA)" flowable:candidateGroups="admin" />
    <sequenceFlow id="flow2" sourceRef="techReview" targetRef="securityCheck" />
    <userTask id="securityCheck" name="Security Compliance" flowable:candidateGroups="admin" />
    <sequenceFlow id="flow3" sourceRef="securityCheck" targetRef="finalApproval" />
    <userTask id="finalApproval" name="Final Management Approval" flowable:candidateGroups="admin" />
    <sequenceFlow id="flow4" sourceRef="finalApproval" targetRef="endEvent" />
    <endEvent id="endEvent" name="End" />
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_risk_sql_approval">
    <bpmndi:BPMNPlane bpmnElement="risk_sql_approval" id="BPMNPlane_risk_sql_approval">
      <bpmndi:BPMNShape bpmnElement="startEvent" id="BPMNShape_startEvent">
        <omgdc:Bounds height="30.0" width="30.0" x="100.0" y="163.0" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape bpmnElement="techReview" id="BPMNShape_techReview">
        <omgdc:Bounds height="80.0" width="100.0" x="180.0" y="138.0" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape bpmnElement="securityCheck" id="BPMNShape_securityCheck">
        <omgdc:Bounds height="80.0" width="100.0" x="330.0" y="138.0" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape bpmnElement="finalApproval" id="BPMNShape_finalApproval">
        <omgdc:Bounds height="80.0" width="100.0" x="480.0" y="138.0" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape bpmnElement="endEvent" id="BPMNShape_endEvent">
        <omgdc:Bounds height="28.0" width="28.0" x="650.0" y="164.0" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge bpmnElement="flow1" id="BPMNEdge_flow1">
        <omgdi:waypoint x="130.0" y="178.0" />
        <omgdi:waypoint x="180.0" y="178.0" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge bpmnElement="flow2" id="BPMNEdge_flow2">
        <omgdi:waypoint x="280.0" y="178.0" />
        <omgdi:waypoint x="330.0" y="178.0" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge bpmnElement="flow3" id="BPMNEdge_flow3">
        <omgdi:waypoint x="430.0" y="178.0" />
        <omgdi:waypoint x="480.0" y="178.0" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge bpmnElement="flow4" id="BPMNEdge_flow4">
        <omgdi:waypoint x="580.0" y="178.0" />
        <omgdi:waypoint x="650.0" y="178.0" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`

    this.logger.info('Deploying risk_sql_approval to Flowable...')
    try {
      await service.deployProcessDefinition('risk_sql_approval', xmlContent)

      // Sync default roles as groups
      this.logger.info('Syncing roles to Flowable groups...')
      await service.syncGroup('admin', 'Administrator')
      await service.syncGroup('developer', 'Developer')
      await service.syncGroup('operator', 'Operator')

      this.logger.success('Workflow and Identity seeded successfully!')
    } catch (error) {
      this.logger.error(`Failed to seed workflow: ${error.message}`)
    }
  }
}
